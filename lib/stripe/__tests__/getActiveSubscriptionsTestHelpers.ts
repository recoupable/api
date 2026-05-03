import type Stripe from "stripe";

export function getActiveSubscriptionsTestHelpers() {
  const testAccountId = "acc-a";

  function subscription(id: string, accountId: string): Stripe.Subscription {
    return { id, metadata: { accountId } } as Stripe.Subscription;
  }

  function subscriptionListPage(
    data: Stripe.Subscription[],
    hasMore: boolean,
  ): Stripe.Response<Stripe.ApiList<Stripe.Subscription>> {
    return { data, has_more: hasMore } as Stripe.Response<Stripe.ApiList<Stripe.Subscription>>;
  }

  return { testAccountId, subscription, subscriptionListPage };
}
