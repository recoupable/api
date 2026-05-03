import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

export async function getActiveSubscriptions(accountId: string): Promise<Stripe.Subscription[]> {
  try {
    const subscriptions = await stripeClient.subscriptions.list({
      limit: 100,
      current_period_end: {
        gt: Math.floor(Date.now() / 1000),
      },
    });

    const activeSubscriptions =
      subscriptions?.data?.filter(
        (subscription: Stripe.Subscription) => subscription.metadata?.accountId === accountId,
      ) ?? [];

    return activeSubscriptions;
  } catch (error) {
    console.error("[getActiveSubscriptions]", error);
    return [];
  }
}
