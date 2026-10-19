import supabase from "../serverClient";

/**
 * Select one account_artist_ids row that holds the given account as an artist.
 *
 * @param artistId - The account to look up as an artist.
 * @returns A row naming an owning account, or null when no account holds it.
 */
export async function selectArtistOwnerLink(artistId: string) {
  const { data, error } = await supabase
    .from("account_artist_ids")
    .select("account_id")
    .eq("artist_id", artistId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch account_artist_ids: ${error.message}`);

  return data;
}
