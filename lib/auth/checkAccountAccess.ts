import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";

/**
 * The type of entity the target account_id represents relative to the caller.
 *
 * - "self": The caller's own account
 * - "artist": An artist the caller manages
 * - "organization": An organization the caller belongs to
 */
export type AccountEntityType = "self" | "artist" | "organization";

/**
 * Result of checking account access.
 */
export interface CheckAccountAccessResult {
  hasAccess: boolean;
  /** The entity type of the target account (only set when hasAccess is true). */
  entityType?: AccountEntityType;
}

/**
 * Check if an authenticated account can access a target account.
 *
 * Tries all access paths in order:
 * 1. Self-access (target === caller)
 * 2. Artist access (via account_artist_ids or shared org)
 * 3. Organization access (caller is a member of the target org)
 *
 * Returns the first match with the entity type, or { hasAccess: false } if none.
 * Fails closed: any database error results in denied access.
 *
 * @param authenticatedAccountId - The caller's account ID
 * @param targetAccountId - The account ID being accessed
 * @returns Access result with entity type
 */
export async function checkAccountAccess(
  authenticatedAccountId: string,
  targetAccountId: string,
): Promise<CheckAccountAccessResult> {
  // 1. Self-access — the caller is accessing their own account
  if (targetAccountId === authenticatedAccountId) {
    return { hasAccess: true, entityType: "self" };
  }

  // 2. Artist access — target is an artist the caller manages
  const isArtist = await checkAccountArtistAccess(authenticatedAccountId, targetAccountId);
  if (isArtist) {
    return { hasAccess: true, entityType: "artist" };
  }

  // 3. Organization access — target is an org the caller belongs to
  const isOrg = await validateOrganizationAccess({
    accountId: authenticatedAccountId,
    organizationId: targetAccountId,
  });
  if (isOrg) {
    return { hasAccess: true, entityType: "organization" };
  }

  return { hasAccess: false };
}
