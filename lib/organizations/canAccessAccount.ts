import type { AccountAccessObservation } from "@/lib/auth/VerificationEvidence";
import { RECOUP_ORG_ID } from "@/lib/const";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { selectAccountOrganizationIds } from "@/lib/supabase/account_organization_ids/selectAccountOrganizationIds";

export interface CanAccessAccountParams {
  /** The account ID of the API key owner */
  currentAccountId: string;
  /** The account ID being accessed */
  targetAccountId: string;
  onAllowed?: (observation: AccountAccessObservation) => void;
}

/**
 * Checks if currentAccountId can access targetAccountId via shared org membership.
 *
 * Access rules:
 * 1. If currentAccountId is in RECOUP_ORG, grants universal admin access
 * 2. If targetAccountId is an organization the caller belongs to, grants access
 *    (organizations are accounts; org-scoped billing reads and writes use the
 *    org id as the target)
 * 3. Otherwise, checks if both accounts share at least one org
 *
 * @param params - The validation parameters
 * @returns true if access is allowed, false otherwise
 */
export async function canAccessAccount(params: CanAccessAccountParams): Promise<boolean> {
  const { currentAccountId, targetAccountId } = params;

  if (!currentAccountId || !targetAccountId) {
    return false;
  }

  if (currentAccountId === targetAccountId) {
    params.onAllowed?.({ basis: "self" });
    return true;
  }

  const currentOrgs = await getAccountOrganizations({
    accountId: currentAccountId,
  });

  if (!currentOrgs.length) {
    return false;
  }

  if (currentOrgs.some(m => m.organization_id === RECOUP_ORG_ID)) {
    params.onAllowed?.({ basis: "admin_membership", organizationId: RECOUP_ORG_ID });
    return true;
  }

  const orgIds = currentOrgs.map(m => m.organization_id);
  if (orgIds.includes(targetAccountId)) {
    params.onAllowed?.({ basis: "organization_membership", organizationId: targetAccountId });
    return true;
  }

  const shared = await selectAccountOrganizationIds(targetAccountId, orgIds);

  const allowed = Array.isArray(shared) && shared.length > 0;
  if (allowed && shared[0].organization_id)
    params.onAllowed?.({ basis: "shared_membership", organizationId: shared[0].organization_id });
  return allowed;
}
