import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";

/**
 * Read subscriber account_ids straight from active Stripe subscription
 * metadata. The `accountId` is stamped onto subscriptions at checkout, so no
 * Supabase round-trip is needed.
 */
export async function getSubscriberAccountIds(): Promise<string[]> {
  const activeSubscriptions = await getActiveSubscriptions();

  return activeSubscriptions
    .map(subscription => subscription.metadata?.accountId)
    .filter((accountId): accountId is string => Boolean(accountId));
}
