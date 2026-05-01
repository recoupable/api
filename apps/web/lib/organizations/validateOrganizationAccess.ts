import { getAccountOrganizations } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

export interface ValidateOrganizationAccessParams {
  accountId: string;
  organizationId: string;
}

/**
 * Validates if an account can operate on behalf of an organization.
 *
 * Access rules:
 * - If accountId equals organizationId (account IS the org), access is granted
 * - Otherwise, checks if accountId is a member of the organization
 *
 * @param params - The validation parameters
 * @param params.accountId - The account ID to validate
 * @param params.organizationId - The organization ID to check access for
 * @returns true if access is allowed, false otherwise
 */
export async function validateOrganizationAccess(
  params: ValidateOrganizationAccessParams,
): Promise<boolean> {
  const { accountId, organizationId } = params;

  if (!accountId || !organizationId) {
    return false;
  }

  // Account IS the organization
  if (accountId === organizationId) {
    return true;
  }

  // Check if account is a member of the organization
  const memberships = await getAccountOrganizations({
    accountId,
    organizationId,
  });

  return memberships.length > 0;
}
