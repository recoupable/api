import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import type { GetArtistsOptions } from "@/lib/artists/getArtists";

export interface BuildGetArtistsParamsInput {
  /** The authenticated account ID */
  accountId: string;
  /** Optional target account ID to filter by */
  targetAccountId?: string;
  /** Optional organization filter for which artists to show */
  orgIdFilter?: string;
}

export type BuildGetArtistsParamsResult =
  | { params: GetArtistsOptions; error: null }
  | { params: null; error: string };

/**
 * Builds the parameters for getArtists based on auth context.
 *
 * Defaults to the authenticated accountId. If targetAccountId is provided,
 * validates the override with canAccessAccount before using that account.
 * Omitting orgIdFilter selects personal artists; a supplied value filters
 * artists to that organization for the resolved account.
 *
 * @param input - The auth context and optional filters
 * @returns The params for getArtists or an error
 */
export async function buildGetArtistsParams(
  input: BuildGetArtistsParamsInput,
): Promise<BuildGetArtistsParamsResult> {
  const { accountId, targetAccountId, orgIdFilter } = input;

  let effectiveAccountId = accountId;

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
    effectiveAccountId = targetAccountId;
  }

  // When orgIdFilter is omitted, default to personal artists (null = personal only)
  // When orgIdFilter is provided, filter to that organization's artists
  const effectiveOrgId = orgIdFilter ?? null;

  return {
    params: { accountId: effectiveAccountId, orgId: effectiveOrgId },
    error: null,
  };
}
