import { selectArtistOwnerLink } from "@/lib/supabase/account_artist_ids/selectArtistOwnerLink";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";

/**
 * Whether an account is an artist: held by another account
 * (account_artist_ids) or by an organization (artist_organization_ids).
 *
 * Throws when a lookup fails, so a database error is never read as "not an
 * artist" and charged.
 *
 * @param accountId - The account to check.
 * @returns true when the account is an artist.
 */
export async function isArtistAccount(accountId: string): Promise<boolean> {
  if (await selectArtistOwnerLink(accountId)) return true;

  const organizations = await selectArtistOrganizationIds(accountId);
  if (!organizations) throw new Error("Failed to fetch artist_organization_ids");

  return organizations.length > 0;
}
