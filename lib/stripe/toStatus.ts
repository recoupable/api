import type Stripe from "stripe";

export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "none";

const SUPPORTED: ReadonlySet<SubscriptionStatus> = new Set([
  "active",
  "trialing",
  "canceled",
  "past_due",
]);

/**
 * Maps a Stripe subscription status to the documented `SubscriptionStatus` enum.
 * Unsupported Stripe statuses (e.g. `incomplete`, `unpaid`) collapse to `"none"`.
 */
export function toStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  return SUPPORTED.has(stripeStatus as SubscriptionStatus)
    ? (stripeStatus as SubscriptionStatus)
    : "none";
}
