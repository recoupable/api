import supabase from "../serverClient";

/**
 * Selects the count of artist_segments records for a given artist account.
 *
 * @param artist_account_id - The unique identifier of the artist account
 * @returns The count of artist_segments records, or 0 if none found
 * @throws Error if the query fails
 */
export async function selectArtistSegmentsCount(artist_account_id: string): Promise<number> {
  const { count, error } = await supabase
    .from("artist_segments")
    .select("*", { count: "exact", head: true })
    .eq("artist_account_id", artist_account_id);

  if (error) {
    throw new Error(`Failed to fetch artist segments count: ${error.message}`);
  }

  return count ?? 0;
}
