import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { GetArtistsOptions } from "@/lib/artists/getArtists";

export interface BuildGetArtistsParamsInput {
  /** The authenticated account ID */
  accountId: string;
  /** The organization ID from the API key (null for personal keys) */
  orgId: string | null;
  /** Optional target account ID to filter by (account_id query param) */
  targetAccountId?: string;
  /** Optional organization ID to filter artists by (organization_id query param) */
  organizationId?: string;
}

export type BuildGetArtistsParamsResult =
  | { params: GetArtistsOptions; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for getArtists based on auth context.
 *
 * Determines which accountId to use:
 * - If targetAccountId is provided, validates access via canAccessAccount
 * - Otherwise, uses the auth-derived accountId
 *
 * Determines orgId filter:
 * - If organizationId query param is provided, uses it
 * - Otherwise, defaults to null (personal artists only)
 *
 * @param input - The auth context and optional filters
 * @returns The params for getArtists or an error
 */
export async function buildGetArtistsParams(
  input: BuildGetArtistsParamsInput,
): Promise<BuildGetArtistsParamsResult> {
  const { accountId, orgId, targetAccountId, organizationId } = input;

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
    return {
      params: { accountId: targetAccountId, orgId: organizationId ?? null },
      error: null,
    };
  }

  // No account_id filter - use auth-derived accountId
  return {
    params: { accountId, orgId: organizationId ?? null },
    error: null,
  };
}
