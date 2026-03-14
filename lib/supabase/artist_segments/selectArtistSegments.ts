import supabase from "../serverClient";

/**
 * Selects artist_segments records for an artist account.
 *
 * @param artist_account_id - The artist account ID
 * @returns Array of artist_segments records with segment_id, or empty array if none found or on error
 */
export async function selectArtistSegments(artist_account_id: string) {
  const { data, error } = await supabase
    .from("artist_segments")
    .select("segment_id")
    .eq("artist_account_id", artist_account_id);

  if (error) {
    console.error("Error fetching artist segments:", error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data;
}
