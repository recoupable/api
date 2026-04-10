import supabase from "../serverClient";

export interface UpsertAccountArtistPinParams {
  accountId: string;
  artistId: string;
  pinned: boolean;
}

/**
 * Upserts the pinned state for an account/artist pair.
 *
 * This supports pinning org-access artists that may not yet have a direct
 * account_artist_ids row for the authenticated account.
 *
 * @param params - The account/artist pin state to persist
 * @param params.accountId - Authenticated account ID
 * @param params.artistId - Artist account ID whose pin state is changing
 * @param params.pinned - Desired pinned state for the account/artist pair
 */
export async function upsertAccountArtistPin({
  accountId,
  artistId,
  pinned,
}: UpsertAccountArtistPinParams): Promise<void> {
  const { error } = await supabase.from("account_artist_ids").upsert(
    {
      account_id: accountId,
      artist_id: artistId,
      pinned,
    },
    { onConflict: "account_id,artist_id" },
  );

  if (error) {
    throw new Error(`Failed to update pinned status: ${error.message}`);
  }
}
