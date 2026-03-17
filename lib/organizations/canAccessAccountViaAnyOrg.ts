import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

export interface CanAccessAccountViaAnyOrgParams {
  /** The account ID of the API key owner */
  currentAccountId: string;
  /** The account ID being accessed */
  targetAccountId: string;
}

/**
 * Checks if a personal API key owner can access a target account via shared org membership.
 *
 * Looks up all organizations the currentAccountId belongs to, then checks if
 * targetAccountId is a member of any of those organizations.
 *
 * @param params - The parameters
 * @param params.currentAccountId - The account ID of the API key owner
 * @param params.targetAccountId - The account ID to access
 * @returns true if they share at least one org, false otherwise
 */
export async function canAccessAccountViaAnyOrg(
  params: CanAccessAccountViaAnyOrgParams,
): Promise<boolean> {
  const { currentAccountId, targetAccountId } = params;

  // Get all orgs the current account belongs to
  const memberships = await getAccountOrganizations({ accountId: currentAccountId });

  if (!memberships.length) {
    return false;
  }

  const orgIds = memberships.map(m => m.organization_id);

  // Check if target account is in any of those orgs
  const shared = await selectAccountOrganizationIds(targetAccountId, orgIds);

  return Array.isArray(shared) && shared.length > 0;
}
