import { upsertAccountArtistPin } from "@/lib/supabase/account_artist_ids/upsertAccountArtistPin";
export interface PinArtistParams {
  artistId: string;
  pinned: boolean;
  requesterAccountId: string;
}

/**
 * Persists the authenticated account's pin state for an artist.
 *
 * @param params - Validated pin artist request
 * @param params.artistId - Artist account ID to pin or unpin
 * @param params.pinned - Desired pinned state for the authenticated account
 * @param params.requesterAccountId - Authenticated account performing the action
 */
export async function pinArtist({
  artistId,
  pinned,
  requesterAccountId,
}: PinArtistParams): Promise<void> {
  await upsertAccountArtistPin({
    accountId: requesterAccountId,
    artistId,
    pinned,
  });
}
