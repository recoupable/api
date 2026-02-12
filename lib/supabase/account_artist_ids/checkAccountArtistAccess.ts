import { selectAccountArtistId } from "./selectAccountArtistId";
import { selectArtistOrganizationIds } from "../artist_organization_ids/selectArtistOrganizationIds";
import { selectAccountOrganizationIds } from "../account_organization_ids/selectAccountOrganizationIds";

/**
 * Check if an account has access to a specific artist.
 *
 * Access is granted if:
 * 1. Account has direct access via account_artist_ids, OR
 * 2. Account and artist share an organization
 *
 * Fails closed: returns false on any database error to deny access safely.
 *
 * @param accountId - The account ID to check
 * @param artistId - The artist ID to check access for
 * @returns true if the account has access to the artist, false otherwise
 */
export async function checkAccountArtistAccess(
  accountId: string,
  artistId: string,
): Promise<boolean> {
  // 1. Check direct access via account_artist_ids
  const directAccess = await selectAccountArtistId(accountId, artistId);

  if (directAccess) return true;

  // 2. Check organization access: account and artist share an org
  const artistOrgs = await selectArtistOrganizationIds(artistId);

  if (!artistOrgs) return false; // Fail closed on error

  if (!artistOrgs.length) return false;

  const orgIds = artistOrgs
    .map((o) => o.organization_id)
    .filter((id): id is string => Boolean(id));
  if (!orgIds.length) return false;

  const userOrgAccess = await selectAccountOrganizationIds(accountId, orgIds);

  if (!userOrgAccess) return false; // Fail closed on error

  return !!userOrgAccess.length;
}
