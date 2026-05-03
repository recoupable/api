import type Stripe from "stripe";

export function isActiveSubscription(subscription?: Stripe.Subscription | null): boolean {
  if (!subscription) return false;
  const isTrial = subscription.status === "trialing";
  const isCanceledTrial = isTrial && subscription.canceled_at;
  return !isCanceledTrial;
}
