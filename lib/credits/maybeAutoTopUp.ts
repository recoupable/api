import { decideAutoTopUp } from "@/lib/credits/decideAutoTopUp";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { findStripeCustomerForAccount } from "@/lib/stripe/findStripeCustomerForAccount";
import { chargeCustomerOffSession } from "@/lib/stripe/chargeCustomerOffSession";
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
  | { kind: "pending"; paymentIntentId: string }
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
    const decision = await decideAutoTopUp(accountId, now);
    if (!decision) return { kind: "skipped" };
    const stamp = now.toISOString();
    await updateCreditsUsage({ account_id: accountId, updates: { auto_topup_last_run_at: stamp } });
    const amountCents = creditsToStripeCents(decision.amountCredits);
    const fail = (message: string) =>
      disableAutoTopUpAfterFailure({ accountId, amountCents, message, stamp });

    const customer = await findStripeCustomerForAccount(accountId);
    if (!customer) return fail(NO_CARD);
    const charge = await chargeCustomerOffSession({
      customer,
      totalCents: amountCents,
      metadata: {
        accountId,
        credits: String(decision.amountCredits),
        purpose: CREDIT_TOPUP_PURPOSE,
        trigger: "auto_topup",
      },
      idempotencyKey: `autotopup:${accountId}:${decision.previousRunAt ?? "first"}`,
    });
    if (charge.kind === "charged") {
      await sendAutoTopUpEmail({ accountId, kind: "receipt", amountCents });
      return charge;
    }
    if (charge.kind === "pending") return charge;
    return fail(
      charge.kind === "no_payment_method"
        ? NO_CARD
        : (charge.declineReason?.message ?? "The card could not be charged"),
    );
  } catch (error) {
    console.error(`[maybeAutoTopUp] failed for account ${accountId}:`, error);
    return { kind: "error" };
  }
}
