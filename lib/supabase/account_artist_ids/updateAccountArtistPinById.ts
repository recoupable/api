import supabase from "../serverClient";

/**
 * Update the `pinned` state of a single account_artist_ids row by its primary key.
 *
 * @param id - Row primary key
 * @param pinned - Desired pinned state
 * @throws Error if the update fails
 */
export async function updateAccountArtistPinById(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from("account_artist_ids")
    .update({ pinned })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update pinned status: ${error.message}`);
  }
}
