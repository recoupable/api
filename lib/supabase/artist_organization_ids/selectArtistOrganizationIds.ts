import supabase from "../serverClient";

/**
 * Select all organization IDs for a given artist.
 *
 * @param artistId - The artist ID
 * @returns Array of rows with organization_id, or null on error
 */
export async function selectArtistOrganizationIds(artistId: string) {
  const { data, error } = await supabase
    .from("artist_organization_ids")
    .select("organization_id")
    .eq("artist_id", artistId);

  if (error) {
    return null;
  }

  return data || [];
}
