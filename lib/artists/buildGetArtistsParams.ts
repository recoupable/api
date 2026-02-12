import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { GetArtistsOptions } from "@/lib/artists/getArtists";
import { RECOUP_ORG_ID } from "@/lib/const";

export interface BuildGetArtistsParamsInput {
  /** The authenticated account ID */
  accountId: string;
  /** The organization ID from the API key (null for personal keys) */
  orgId: string | null;
  /** Optional target account ID to filter by */
  targetAccountId?: string;
  /** Optional organization filter for which artists to show */
  orgIdFilter?: string;
  /** Whether to show only personal (non-org) artists */
  personal?: boolean;
}

export type BuildGetArtistsParamsResult =
  | { params: GetArtistsOptions; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for getArtists based on auth context.
 *
 * For personal keys: Returns the key owner's accountId
 * For org keys: Returns the key owner's accountId (can override with targetAccountId)
 * For Recoup admin key: Returns the key owner's accountId (can override with targetAccountId)
 *
 * If targetAccountId is provided, validates access and returns that account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for getArtists or an error
 */
export async function buildGetArtistsParams(
  input: BuildGetArtistsParamsInput,
): Promise<BuildGetArtistsParamsResult> {
  const { accountId, orgId, targetAccountId, orgIdFilter, personal } = input;

  let effectiveAccountId = accountId;

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
    effectiveAccountId = targetAccountId;
  }

  // Determine orgId filter: personal=true means null, org_id means specific org
  const effectiveOrgId = personal ? null : orgIdFilter;

  return {
    params: { accountId: effectiveAccountId, orgId: effectiveOrgId },
    error: null,
  };
}
