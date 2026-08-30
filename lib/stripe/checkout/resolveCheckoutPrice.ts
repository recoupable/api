import {
  STRIPE_STARTER_PRICE_ID,
  STRIPE_SUBSCRIPTION_PRICE_ID,
  STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
} from "@/lib/stripe/config";
import type { CheckoutPlan } from "@/lib/stripe/checkout/checkoutPlan";

export type CheckoutPrice = {
  price: string;
  /** Only Pro carries a trial; Starter charges on completion. */
  trialPeriodDays?: number;
};

/**
 * The Stripe price (and trial) a plan checks out with. Starter resolves to
 * null until `STRIPE_STARTER_PRICE_ID` is set in the environment, so the
 * handler can answer `starter_unavailable` instead of minting a broken
 * session.
 */
export function resolveCheckoutPrice(plan: CheckoutPlan): CheckoutPrice | null {
  if (plan === "pro") {
    return {
      price: STRIPE_SUBSCRIPTION_PRICE_ID,
      trialPeriodDays: STRIPE_SUBSCRIPTION_TRIAL_PERIOD_DAYS,
    };
  }
  if (!STRIPE_STARTER_PRICE_ID) return null;
  return { price: STRIPE_STARTER_PRICE_ID };
}
