import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import { selectAccountEmailsByAccountIds } from "@/lib/supabase/account_emails/selectAccountEmailsByAccountIds";

/**
 * Resolve subscriber account_ids from Stripe subscription metadata and look
 * up their account_emails. The Stripe call is capped at 100 per
 * `getActiveSubscriptions` — acceptable today, revisit with pagination if the
 * active set ever exceeds that.
 */
export async function getSubscriberAccountEmails() {
  const activeSubscriptions = await getActiveSubscriptions();

  const accountIds = activeSubscriptions
    .map(subscription => subscription.metadata?.accountId)
    .filter((accountId): accountId is string => Boolean(accountId));

  return selectAccountEmailsByAccountIds(accountIds);
}
