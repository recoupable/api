import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { GetAccountOrganizationsParams } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";
import { RECOUP_ORG_ID } from "@/lib/const";

export interface BuildGetOrganizationsParamsInput {
  /** The authenticated account ID */
  accountId: string;
  /** The organization ID from the API key (null for personal keys) */
  orgId: string | null;
  /** Optional target account ID to filter by */
  targetAccountId?: string;
}

export type BuildGetOrganizationsParamsResult =
  | { params: GetAccountOrganizationsParams; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for getAccountOrganizations based on auth context.
 *
 * For personal keys: Returns accountId with the key owner's account
 * For org keys: Returns organizationId for filtering by org membership
 * For Recoup admin key: Returns empty params to indicate ALL records
 *
 * If targetAccountId is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for getAccountOrganizations or an error
 */
export async function buildGetOrganizationsParams(
  input: BuildGetOrganizationsParamsInput,
): Promise<BuildGetOrganizationsParamsResult> {
  const { accountId, orgId, targetAccountId } = input;

  // Handle account_id filter if provided
  if (targetAccountId) {
    const hasAccess = await canAccessAccount({ orgId, targetAccountId });
    if (!hasAccess) {
      return {
        params: null,
        error: orgId
          ? "account_id is not a member of this organization"
          : "Personal API keys cannot filter by account_id",
      };
    }
    return { params: { accountId: targetAccountId }, error: null };
  }

  // No account_id filter - determine what to return based on key type
  if (orgId === RECOUP_ORG_ID) {
    // Recoup admin: return empty params to indicate ALL records
    return { params: {}, error: null };
  }

  if (orgId) {
    // Org key: return organizationId for filtering by org membership
    return { params: { organizationId: orgId }, error: null };
  }

  // Personal key: Only return the key owner's organizations
  return { params: { accountId }, error: null };
}
