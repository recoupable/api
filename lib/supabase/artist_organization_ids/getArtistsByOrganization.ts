import supabase from "../serverClient";
import type { ArtistQueryRow } from "@/lib/artists/getFormattedArtist";

// Raw row type returned by this query
export type ArtistOrgRow = ArtistQueryRow & { artist_id: string };

/**
 * Get all artists that belong to an organization (or multiple organizations).
 * Returns raw data - formatting should be done by caller.
 *
 * @param organizationIds - Array of organization IDs
 * @returns Array of raw artist rows from database (empty array if no results)
 * @throws PostgrestError if the Supabase query fails
 */
export async function getArtistsByOrganization(organizationIds: string[]): Promise<ArtistOrgRow[]> {
  if (!organizationIds || organizationIds.length === 0) return [];

  const { data, error } = await supabase
    .from("artist_organization_ids")
    .select(
      `
      artist_id,
      artist_info:accounts!artist_organization_ids_artist_id_fkey (
        *,
        account_socials (
          *,
          social:socials (*)
        ),
        account_info (*)
      )
    `,
    )
    .in("organization_id", organizationIds);

  if (error) {
    console.error("[ERROR] getArtistsByOrganization:", {
      organizationIds,
      error: error.message,
      code: error.code,
    });
    throw error;
  }

  return (data || []) as unknown as ArtistOrgRow[];
}

