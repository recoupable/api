import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { updateAccountArtistPinById } from "@/lib/supabase/account_artist_ids/updateAccountArtistPinById";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

export interface SetAccountArtistPinParams {
  accountId: string;
  artistId: string;
  pinned: boolean;
}

/**
 * Sets the pinned state for an (account, artist) pair. Updates the existing
 * row when one is already linked, otherwise inserts a new row (e.g. when
 * pinning an artist the account only has access to via their organization).
 *
 * @param params.accountId - Authenticated account ID
 * @param params.artistId - Artist account ID whose pin state is changing
 * @param params.pinned - Desired pinned state
 */
export async function setAccountArtistPin({
  accountId,
  artistId,
  pinned,
}: SetAccountArtistPinParams): Promise<void> {
  const existing = await selectAccountArtistId(accountId, artistId);

  if (existing) {
    await updateAccountArtistPinById(existing.id, pinned);
    return;
  }

  await insertAccountArtistId(accountId, artistId, { pinned });
}
