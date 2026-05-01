import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import type Stripe from "stripe";

/**
 * Returns the first active Stripe subscription found across any of the
 * given account's organizations, or null when none.
 */
export async function getOrgSubscription(accountId: string): Promise<Stripe.Subscription | null> {
  if (!accountId) return null;

  const accountOrgs = await getAccountOrganizations({ accountId });
  if (accountOrgs.length === 0) return null;

  const orgIds = accountOrgs
    .map(org => org.organization_id)
    .filter((id): id is string => id !== null);

  const subscriptions = await Promise.all(orgIds.map(orgId => getActiveSubscriptionDetails(orgId)));

  return subscriptions.find(sub => sub !== null) ?? null;
}
