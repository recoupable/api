import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import type Stripe from "stripe";

/**
 * Returns the first active Stripe subscription for the given account,
 * or null if none exists.
 */
export const getActiveSubscriptionDetails = async (
  accountId: string,
): Promise<Stripe.Subscription | null> => {
  try {
    const activeSubscriptions = await getActiveSubscriptions(accountId);
    return activeSubscriptions.length > 0 ? activeSubscriptions[0] : null;
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return null;
  }
};
