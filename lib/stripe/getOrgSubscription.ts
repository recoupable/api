import type Stripe from "stripe";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

/**
 * Returns an active Stripe subscription for one of the account's organizations, if any.
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
