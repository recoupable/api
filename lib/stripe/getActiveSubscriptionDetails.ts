import Stripe from "stripe";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";

/**
 * Returns the first active Stripe subscription for an account, or null.
 *
 * Thin wrapper around `getActiveSubscriptions` for the common "does this
 * account have a paid subscription?" question.
 */
export async function getActiveSubscriptionDetails(
  accountId: string,
): Promise<Stripe.Subscription | null> {
  try {
    const subs = await getActiveSubscriptions(accountId);
    return subs.length > 0 ? subs[0] : null;
  } catch (error) {
    console.error("[ERROR] getActiveSubscriptionDetails:", error);
    return null;
  }
}
