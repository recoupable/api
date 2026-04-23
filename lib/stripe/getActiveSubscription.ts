import Stripe from "stripe";
import stripeClient from "@/lib/stripe/client";

/**
 * Returns the first active Stripe subscription tagged with `metadata.accountId`,
 * or null. Uses `subscriptions.search` so the metadata + status filter runs on
 * Stripe's side — scales independently of total subscription count (the prior
 * `list({ limit: 100 })` + client-side filter was lossy once the active set
 * crossed 100). Search is eventually consistent (~1 min lag after writes).
 */
export async function getActiveSubscription(
  accountId: string,
): Promise<Stripe.Subscription | null> {
  try {
    const result = await stripeClient.subscriptions.search({
      query: `status:"active" AND metadata["accountId"]:"${accountId}"`,
      limit: 1,
    });
    return result.data[0] ?? null;
  } catch (error) {
    console.error("[ERROR] getActiveSubscription:", error);
    return null;
  }
}
