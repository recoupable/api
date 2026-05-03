import type Stripe from "stripe";

export const ACC = "acc-a";

export function sub(id: string, accountId: string): Stripe.Subscription {
  return { id, metadata: { accountId } } as Stripe.Subscription;
}

export function apiList(
  data: Stripe.Subscription[],
  hasMore: boolean,
): Stripe.Response<Stripe.ApiList<Stripe.Subscription>> {
  return { data, has_more: hasMore } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>;
}
