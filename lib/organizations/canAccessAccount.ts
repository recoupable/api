import { RECOUP_ORG_ID } from "@/lib/const";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

export interface CanAccessAccountParams {
  orgId: string | null;
  targetAccountId: string;
  /** Optional: the account ID of the API key owner, for shared-org fallback when orgId is null */
  currentAccountId?: string;
}

/**
 * Validates if an account can access a target account.
 *
 * Access rules:
 * 1. If orgId is RECOUP_ORG_ID, always grants access (universal admin access)
 * 2. If orgId is present, checks if targetAccountId is a member of that org
 * 3. If orgId is null and currentAccountId is provided, checks if they share any org
 *    (includes RECOUP_ORG_ID bypass if currentAccountId is an admin)
 *
 * @param params - The validation parameters
 * @returns true if access is allowed, false otherwise
 */
export async function canAccessAccount(params: CanAccessAccountParams): Promise<boolean> {
  const { orgId, targetAccountId, currentAccountId } = params;

  if (!targetAccountId) {
    return false;
  }

  // Path 1: org key with explicit orgId
  if (orgId) {
    if (orgId === RECOUP_ORG_ID) {
      return true;
    }

    const memberships = await getAccountOrganizations({
      accountId: targetAccountId,
      organizationId: orgId,
    });

    return memberships.length > 0;
  }

  // Path 2: personal key — check shared org membership
  if (!currentAccountId) {
    return false;
  }

  const currentOrgs = await getAccountOrganizations({ accountId: currentAccountId });

  if (!currentOrgs.length) {
    return false;
  }

  // Admin bypass: if currentAccountId is in the Recoup admin org, grant universal access
  if (currentOrgs.some((m) => m.organization_id === RECOUP_ORG_ID)) {
    return true;
  }

  const orgIds = currentOrgs.map((m) => m.organization_id);
  const shared = await selectAccountOrganizationIds(targetAccountId, orgIds);

  return Array.isArray(shared) && shared.length > 0;
}
