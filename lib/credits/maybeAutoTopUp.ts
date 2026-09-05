import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { claimAutoTopUpLease } from "@/lib/supabase/credits_usage/claimAutoTopUpLease";
import { updateAutoTopUpFailure } from "@/lib/supabase/credits_usage/updateAutoTopUpFailure";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
import { shouldAutoTopUp } from "@/lib/credits/shouldAutoTopUp";
import { grantAutoTopUpCredits } from "@/lib/credits/grantAutoTopUpCredits";
import { sendAutoTopUpEmail } from "@/lib/credits/sendAutoTopUpEmail";
import { creditsToStripeCents } from "@/lib/credits/creditsToStripeCents";
import { AUTO_TOPUP_PURPOSE } from "@/lib/credits/autoTopUpPurpose";

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
 * Runs after a successful credit deduction. Charges the card on file for the
 * account's chosen amount when the balance fell below its chosen threshold,
 * then grants the credits and emails a receipt. A decline or missing card
 * turns auto top-up off and emails the account instead of retrying. Never
 * throws: the deduction that triggered it must not fail on a billing hiccup.
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

    const lease = await claimAutoTopUpLease({ accountId, now });
    if (!lease) return { kind: "skipped" };

    const amountCents = creditsToStripeCents(amountCredits);
    const customer = await findStripeCustomerForAccount(accountId);
    if (!customer) return disable(accountId, amountCents, NO_CARD);

    const charge = await chargeCustomerOffSession({
      customer,
      totalCents: amountCents,
      metadata: { accountId, credits: String(amountCredits), purpose: AUTO_TOPUP_PURPOSE },
      idempotencyKey: `autotopup:${accountId}:${lease}`,
    });

    if (charge.kind === "charged") {
      await grantAutoTopUpCredits({
        accountId,
        credits: amountCredits,
        paymentIntentId: charge.paymentIntentId,
      });
      await sendAutoTopUpEmail({ accountId, kind: "receipt", amountCents });
      return { kind: "charged", paymentIntentId: charge.paymentIntentId };
    }

    const message =
      charge.kind === "no_payment_method"
        ? NO_CARD
        : (charge.declineReason?.message ?? "The card could not be charged");
    return disable(accountId, amountCents, message);
  } catch (error) {
    console.error(`[maybeAutoTopUp] failed for account ${accountId}:`, error);
    return { kind: "error" };
  }
}

async function disable(
  accountId: string,
  amountCents: number,
  message: string,
): Promise<AutoTopUpOutcome> {
  await updateAutoTopUpFailure({ accountId, message });
  await sendAutoTopUpEmail({ accountId, kind: "declined", amountCents, message });
  return { kind: "disabled", message };
}
