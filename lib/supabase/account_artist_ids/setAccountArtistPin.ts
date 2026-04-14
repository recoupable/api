import supabase from "../serverClient";

export interface SetAccountArtistPinParams {
  accountId: string;
  artistId: string;
  pinned: boolean;
}

/**
 * Sets the pinned state for an account/artist pair.
 *
 * Updates the existing account_artist_ids row when one exists, otherwise
 * inserts a new row (e.g. when pinning an artist the account only has
 * access to via their organization). account_artist_ids has no composite
 * unique constraint on (account_id, artist_id), so a plain upsert with
 * onConflict is not supported — we must look up the row first.
 *
 * @param params - Pin state to persist for the account/artist pair
 * @param params.accountId - Authenticated account ID
 * @param params.artistId - Artist account ID whose pin state is changing
 * @param params.pinned - Desired pinned state
 */
export async function setAccountArtistPin({
  accountId,
  artistId,
  pinned,
}: SetAccountArtistPinParams): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("account_artist_ids")
    .select("id")
    .eq("account_id", accountId)
    .eq("artist_id", artistId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Failed to update pinned status: ${selectError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("account_artist_ids")
      .update({ pinned })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update pinned status: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await supabase
    .from("account_artist_ids")
    .insert({ account_id: accountId, artist_id: artistId, pinned });

  if (insertError) {
    throw new Error(`Failed to update pinned status: ${insertError.message}`);
  }
}
