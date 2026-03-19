import { RECOUP_ORG_ID } from "@/lib/const";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

export interface CanAccessAccountParams {
  /** The account ID of the API key owner */
  currentAccountId: string;
  /** The account ID being accessed */
  targetAccountId: string;
}

/**
 * Checks if currentAccountId can access targetAccountId via shared org membership.
 *
 * Access rules:
 * 1. If currentAccountId is in RECOUP_ORG, grants universal admin access
 * 2. Otherwise, checks if both accounts share at least one org
 *
 * @param params - The validation parameters
 * @returns true if access is allowed, false otherwise
 */
export async function canAccessAccount(params: CanAccessAccountParams): Promise<boolean> {
  const { currentAccountId, targetAccountId } = params;

  if (!currentAccountId || !targetAccountId) {
    return false;
  }

  const currentOrgs = await getAccountOrganizations({
    accountId: currentAccountId,
  });

  if (!currentOrgs.length) {
    return false;
  }

  if (currentOrgs.some(m => m.organization_id === RECOUP_ORG_ID)) {
    return true;
  }

  const orgIds = currentOrgs.map(m => m.organization_id);
  const shared = await selectAccountOrganizationIds(targetAccountId, orgIds);

  return Array.isArray(shared) && shared.length > 0;
}
