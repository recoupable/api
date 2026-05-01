import type Stripe from "stripe";

/**
 * Returns true when the subscription is non-null and not a canceled trial.
 */
const isActiveSubscription = (subscription?: Stripe.Subscription | null): boolean => {
  if (!subscription) return false;
  const isTrial = subscription?.status === "trialing";
  const isCanceledTrial = isTrial && subscription?.canceled_at;
  const subscriptionActive = !isCanceledTrial;
  return subscriptionActive;
};

export default isActiveSubscription;
