import type Stripe from "stripe";

export type SubscriptionInterval = "day" | "week" | "month" | "year";
export type SubscriptionCollectionMethod = "charge_automatically" | "send_invoice";

export interface SubscriptionPlanDetails {
  name: string | null;
  amountCents: number | null;
  currency: string | null;
  interval: SubscriptionInterval | null;
  collectionMethod: SubscriptionCollectionMethod | null;
  currentPeriodEnd: string | null;
}

/**
 * Derives the documented plan details from a Stripe subscription: the first price's
 * nickname (else the expanded product's name), amount, currency and interval, plus the
 * subscription's collection method and current period end as an ISO timestamp.
 */
export function buildSubscriptionPlanDetails(
  subscription: Stripe.Subscription,
): SubscriptionPlanDetails {
  const price = subscription.items?.data?.[0]?.price;
  const product = price?.product;
  const productName =
    product && typeof product === "object" && "name" in product ? product.name : null;

  return {
    name: price?.nickname ?? productName ?? null,
    amountCents: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    interval: price?.recurring?.interval ?? null,
    collectionMethod: subscription.collection_method ?? null,
    currentPeriodEnd:
      typeof subscription.current_period_end === "number"
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
  };
}
