import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { GetAccountOrganizationsParams } from "@/lib/supabase/account_organization_ids/getAccountOrganizations";

export interface BuildGetOrganizationsParamsInput {
  /** The authenticated account ID */
  accountId: string;
  /** Optional target account ID to filter by */
  targetAccountId?: string;
}

export type BuildGetOrganizationsParamsResult =
  | { params: GetAccountOrganizationsParams; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for getAccountOrganizations based on auth context.
 *
 * Returns accountId with the key owner's account.
 * If targetAccountId is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for getAccountOrganizations or an error
 */
export async function buildGetOrganizationsParams(
  input: BuildGetOrganizationsParamsInput,
): Promise<BuildGetOrganizationsParamsResult> {
  const { accountId, targetAccountId } = input;

  // Handle account_id filter if provided
  if (targetAccountId) {
    const hasAccess = await canAccessAccount({
      targetAccountId,
      currentAccountId: accountId,
    });
    if (!hasAccess) {
      return {
        params: null,
        error: "Access denied to specified account_id",
      };
    }
    return { params: { accountId: targetAccountId }, error: null };
  }

  // Return the key owner's organizations
  return { params: { accountId }, error: null };
}
