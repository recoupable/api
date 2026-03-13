import { RECOUP_ORG_ID } from "@/lib/const";
import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

export interface CanAccessAccountParams {
  orgId: string | null;
  targetAccountId: string;
}

/**
 * Validates if an organization can access a target account.
 *
 * Access rules:
 * - If orgId is RECOUP_ORG_ID, always grants access (universal admin access)
 * - Otherwise, checks if targetAccountId is a member of the organization
 *
 * @param params - The validation parameters
 * @param params.orgId - The organization ID from the API key
 * @param params.targetAccountId - The account ID to access
 * @returns true if access is allowed, false otherwise
 */
export async function canAccessAccount(params: CanAccessAccountParams): Promise<boolean> {
  const { orgId, targetAccountId } = params;

  if (!orgId || !targetAccountId) {
    return false;
  }

  // Universal access for Recoup admin organization
  if (orgId === RECOUP_ORG_ID) {
    return true;
  }

  // Check if target account is a member of the organization
  const memberships = await getAccountOrganizations({
    accountId: targetAccountId,
    organizationId: orgId,
  });

  return memberships.length > 0;
}
