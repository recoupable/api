import type Stripe from "stripe";
import { CREDIT_TOPUP_PURPOSE } from "@/lib/stripe/creditsTopupPurpose";
import { incrementRemainingCredits } from "@/lib/supabase/credits_usage/incrementRemainingCredits";

/**
 * Webhook handler for `payment_intent.succeeded` events. Credits the
 * account only for off-session credits top-ups — Checkout-driven
 * payments are handled by `processCreditsTopupSession` on the
 * `checkout.session.completed` event, so this handler skips anything
 * that doesn't carry `metadata.paymentMethod === "off_session"`.
 */
export async function processCreditsTopupPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const metadata = paymentIntent.metadata ?? {};
  if (metadata.purpose !== CREDIT_TOPUP_PURPOSE) return;
  if (metadata.paymentMethod !== "off_session") return;

  const accountId = metadata.accountId;
  if (!accountId || typeof accountId !== "string") {
    throw new Error(
      `Missing accountId metadata on credits_topup PaymentIntent ${paymentIntent.id}`,
    );
  }

  const creditsRaw = metadata.credits;
  const credits = creditsRaw ? Number(creditsRaw) : NaN;
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error(
      `Invalid credits metadata "${creditsRaw}" on credits_topup PaymentIntent ${paymentIntent.id}`,
    );
  }

  await incrementRemainingCredits({ accountId, delta: credits });
}
