import { iterateActiveSubscriptions } from "@/lib/stripe/iterateActiveSubscriptions";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Stream active Stripe subscriptions and collect the `metadata.accountId`
 * set, then resolve their account_emails in one Supabase query. Streaming
 * keeps memory flat — we only retain the deduped account_id strings, not
 * full Subscription objects.
 */
export async function getSubscriberAccountEmails() {
  const accountIds = new Set<string>();
  for await (const subscription of iterateActiveSubscriptions()) {
    const id = subscription.metadata?.accountId;
    if (id) accountIds.add(id);
  }

  if (accountIds.size === 0) return [];

  return selectAccountEmails({ accountIds: Array.from(accountIds) });
}
