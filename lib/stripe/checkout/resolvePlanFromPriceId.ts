import { STRIPE_STARTER_PRICE_ID } from "@/lib/stripe/config";
import type { CheckoutPlan } from "@/lib/stripe/checkout/checkoutPlan";

/**
 * Plan for a Stripe price id: the Starter price when configured and matched,
 * otherwise Pro (every other active subscription price is a Pro price).
 */
export function resolvePlanFromPriceId(priceId: string | undefined): CheckoutPlan {
  return STRIPE_STARTER_PRICE_ID && priceId === STRIPE_STARTER_PRICE_ID ? "starter" : "pro";
}
