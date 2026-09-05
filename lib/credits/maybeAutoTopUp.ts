import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { shouldAutoTopUp } from "@/lib/credits/shouldAutoTopUp";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";
import { disableAutoTopUpAfterFailure } from "@/lib/credits/disableAutoTopUpAfterFailure";
import { creditsToStripeCents } from "@/lib/credits/creditsToStripeCents";
import { CREDIT_TOPUP_PURPOSE } from "@/lib/stripe/creditsTopupPurpose";

interface MaybeAutoTopUpParams {
  accountId: string;
  now?: Date;
}

export type AutoTopUpOutcome =
  | { kind: "skipped" }
  | { kind: "charged"; paymentIntentId: string }
  | { kind: "disabled"; message: string }
  | { kind: "error" };

const NO_CARD = "No card on file";

/**
 * Runs after a successful credit deduction. When the account opted in and the
 * balance is below its threshold, stamps last_run_at and charges the card on
 * file. The Stripe idempotency key derives from the stamp read before the
 * write, so two deductions racing through here send the same key and Stripe
 * returns one PaymentIntent; the ten-minute window in shouldAutoTopUp stops
 * repeats after the stamp lands. Credits are granted by the
 * payment_intent.succeeded webhook, the same path as every other off-session
 * credit purchase. Never throws: the deduction that triggered it must not fail
 * on a billing hiccup.
 */
export async function maybeAutoTopUp({
  accountId,
  now = new Date(),
}: MaybeAutoTopUpParams): Promise<AutoTopUpOutcome> {
  try {
    const settings = await readAutoTopUpSettings(accountId);
    if (!settings?.auto_topup_enabled) return { kind: "skipped" };
    const [usage] = await selectCreditsUsage({ account_id: accountId });
    const amountCredits = settings.auto_topup_amount;
    const shouldRun =
      usage !== undefined &&
      amountCredits !== null &&
      shouldAutoTopUp({
        enabled: settings.auto_topup_enabled,
        amountCredits,
        thresholdCredits: settings.auto_topup_threshold,
        lastRunAt: settings.auto_topup_last_run_at,
        remainingCredits: usage.remaining_credits,
        now,
      });
    if (!shouldRun || amountCredits === null) return { kind: "skipped" };

    await updateCreditsUsage({
      account_id: accountId,
      updates: { auto_topup_last_run_at: now.toISOString() },
    });
    const amountCents = creditsToStripeCents(amountCredits);
    const customer = await findStripeCustomerForAccount(accountId);
    if (!customer) return disableAutoTopUpAfterFailure(accountId, amountCents, NO_CARD);

    const charge = await chargeCustomerOffSession({
      customer,
      totalCents: amountCents,
      metadata: {
        accountId,
        credits: String(amountCredits),
        purpose: CREDIT_TOPUP_PURPOSE,
        trigger: "auto_topup",
      },
      idempotencyKey: `autotopup:${accountId}:${settings.auto_topup_last_run_at ?? "first"}`,
    });
    if (charge.kind === "charged") {
      await sendAutoTopUpEmail({ accountId, kind: "receipt", amountCents });
      return { kind: "charged", paymentIntentId: charge.paymentIntentId };
    }
    const message =
      charge.kind === "no_payment_method"
        ? NO_CARD
        : (charge.declineReason?.message ?? "The card could not be charged");
    return disableAutoTopUpAfterFailure(accountId, amountCents, message);
  } catch (error) {
    console.error(`[maybeAutoTopUp] failed for account ${accountId}:`, error);
    return { kind: "error" };
  }
}
