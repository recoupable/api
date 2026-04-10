import supabase from "../serverClient";

/**
 * Updates the pinned state for an existing account/artist relationship.
 *
 * @param accountId - Authenticated account ID
 * @param artistId - Artist account ID whose pin state is changing
 * @param pinned - Desired pinned state
 */
export async function updateAccountArtistPin(
  accountId: string,
  artistId: string,
  pinned: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("account_artist_ids")
    .update({ pinned })
    .eq("account_id", accountId)
    .eq("artist_id", artistId);

  if (error) {
    throw new Error(`Failed to update pinned status: ${error.message}`);
  }
}
