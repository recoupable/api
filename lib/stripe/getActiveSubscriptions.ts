import type Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

export async function getActiveSubscriptions(accountId: string): Promise<Stripe.Subscription[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const listParams = {
      current_period_end: { gt: now },
    };
    const matches: Stripe.Subscription[] = [];

    for await (const subscription of stripeClient.subscriptions.list(listParams).autoPagingEach()) {
      if (subscription.metadata?.accountId === accountId) {
        matches.push(subscription);
      }
    }

    return matches;
  } catch (error) {
    console.error("[getActiveSubscriptions]", error);
    return [];
  }
}
