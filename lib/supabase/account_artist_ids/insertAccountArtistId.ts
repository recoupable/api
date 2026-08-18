import supabase from "../serverClient";

/**
 * Idempotently links an artist account to an owning account in
 * account_artist_ids. Upserts on the (account_id, artist_id) unique pair
 * (constraint account_artist_ids_account_id_artist_id_key); an existing link
 * is left untouched, so double-linking is a silent no-op (chat#1965).
 *
 * @param accountId - The account ID of the user/owner
 * @param artistId - The account ID of the artist
 * @param options - Optional column values to set on insert (e.g. `pinned`) —
 *   not applied when the link already exists
 * @throws Error if the upsert fails
 */
export async function insertAccountArtistId(
  accountId: string,
  artistId: string,
  options?: { pinned?: boolean },
): Promise<void> {
  const { error } = await supabase.from("account_artist_ids").upsert(
    {
      account_id: accountId,
      artist_id: artistId,
      ...(options?.pinned !== undefined && { pinned: options.pinned }),
    },
    { onConflict: "account_id,artist_id", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`Failed to upsert account-artist relationship: ${error.message}`);
  }
}
