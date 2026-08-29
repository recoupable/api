import type Stripe from "stripe";

/**
 * Held behind `STRIPE_CARDLESS_TRIAL=true` (row 14 of app#2044): when on, a
 * trial checkout does not require a card, and a trial that ends without one
 * cancels instead of failing a charge, so the account falls back to Free.
 * Off by default; only worth turning on if `checkout_opened` still converts
 * to nothing once the plan structure and prompts have shipped.
 *
 * @param trialPeriodDays - The trial on the session; no trial, no change.
 * @returns Extra Checkout params to spread into the session.
 */
export function cardlessTrialParams(
  trialPeriodDays: number | undefined,
): Pick<Stripe.Checkout.SessionCreateParams, "payment_method_collection" | "subscription_data"> {
  if (process.env.STRIPE_CARDLESS_TRIAL !== "true" || !trialPeriodDays) return {};
  return {
    payment_method_collection: "if_required",
    subscription_data: {
      trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    },
  };
}
