import Stripe from "stripe";

/** Stripe statuses that may grant paid access; others (e.g. canceled, unpaid) are not active. */
const isActiveSubscription = (subscription?: Stripe.Subscription | null) => {
  if (!subscription) return false;
  const { status, canceled_at: canceledAt } = subscription;
  if (status === "active") return true;
  if (status === "trialing") return !canceledAt;
  return false;
};

export default isActiveSubscription;
