import { getActiveSubscriptions } from "@/lib/stripe/getActiveSubscriptions";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Resolve subscriber account_ids from active Stripe subscription metadata and
 * look up their account_emails in one Supabase query.
 */
export async function getSubscriberAccountEmails() {
  const activeSubscriptions = await getActiveSubscriptions();

  const accountIds = Array.from(
    new Set(
      activeSubscriptions
        .map(subscription => subscription.metadata?.accountId)
        .filter((accountId): accountId is string => Boolean(accountId)),
    ),
  );

  if (accountIds.length === 0) return [];

  return selectAccountEmails({ accountIds });
}
