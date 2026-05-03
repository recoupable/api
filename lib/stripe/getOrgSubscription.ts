import { getActiveSubscriptionDetails } from "./getActiveSubscriptionDetails";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import Stripe from "stripe";

/**
 * First active Stripe subscription for any organization linked to the account, if any.
 */
export async function getOrgSubscription(accountId: string): Promise<Stripe.Subscription | null> {
  if (!accountId) return null;

  const accountOrgs = await getAccountOrganizations({ accountId });
  if (accountOrgs.length === 0) return null;

  const orgIds = accountOrgs
    .map(org => org.organization_id)
    .filter((id): id is string => id !== null);

  for (const orgId of orgIds) {
    const sub = await getActiveSubscriptionDetails(orgId);
    if (sub) return sub;
  }

  return null;
}
