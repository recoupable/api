import stripeClient from "@/lib/stripe/client";
import type Stripe from "stripe";

/**
 * Returns Stripe subscriptions whose metadata `accountId` matches the
 * given account and whose `current_period_end` is in the future. Returns
 * an empty array on any error (logged).
 */
export const getActiveSubscriptions = async (accountId: string): Promise<Stripe.Subscription[]> => {
  try {
    const subscriptions = await stripeClient.subscriptions.list({
      limit: 100,
      current_period_end: {
        gt: parseInt(Number(Date.now() / 1000).toFixed(0), 10),
      },
    });

    const activeSubscriptions = subscriptions?.data?.filter(
      (subscription: Stripe.Subscription) => subscription.metadata?.accountId === accountId,
    );

    return activeSubscriptions || [];
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return [];
  }
};
