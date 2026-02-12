import supabase from "../serverClient";

/**
 * Select a single account_artist_ids row for a specific account and artist.
 *
 * @param accountId - The account ID
 * @param artistId - The artist ID
 * @returns The row if found, null if not found or on error
 */
export async function selectAccountArtistId(
  accountId: string,
  artistId: string,
) {
  const { data, error } = await supabase
    .from("account_artist_ids")
    .select("artist_id")
    .eq("account_id", accountId)
    .eq("artist_id", artistId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
