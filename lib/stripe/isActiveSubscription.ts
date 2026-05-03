import type Stripe from "stripe";

/**
 * True when Stripe considers the subscription billable pro access: `active`,
 * or `trialing` without cancellation. All other statuses are false.
 */
export function isActiveSubscription(subscription?: Stripe.Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.status === "active") return true;
  if (subscription.status === "trialing") {
    return !subscription.canceled_at;
  }
  return false;
}
