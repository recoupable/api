import type Stripe from "stripe";
import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";

export async function getActiveSubscriptionDetails(
  accountId: string,
): Promise<Stripe.Subscription | null> {
  try {
    const activeSubscriptions = await getActiveSubscriptions(accountId);
    return activeSubscriptions[0] ?? null;
  } catch (error) {
    console.error("[getActiveSubscriptionDetails]", error);
    return null;
  }
}
