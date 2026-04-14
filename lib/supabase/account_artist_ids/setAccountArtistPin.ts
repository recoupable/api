import supabase from "../serverClient";

export interface SetAccountArtistPinParams {
  accountId: string;
  artistId: string;
  pinned: boolean;
}

/**
 * Upserts the authenticated account's pinned state for an artist.
 *
 * Creates the account_artist_ids row if it doesn't exist yet (e.g. when
 * pinning an artist the account only has access to via their organization).
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
  const { error } = await supabase
    .from("account_artist_ids")
    .upsert(
      { account_id: accountId, artist_id: artistId, pinned },
      { onConflict: "account_id,artist_id" },
    );

  if (error) {
    throw new Error(`Failed to update pinned status: ${error.message}`);
  }
}
