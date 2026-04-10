import { insertAccountArtistId } from "./insertAccountArtistId";
import { selectAccountArtistId } from "./selectAccountArtistId";
import { updateAccountArtistPin } from "./updateAccountArtistPin";

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
  const existingRow = await selectAccountArtistId(accountId, artistId);

  if (existingRow) {
    await updateAccountArtistPin(accountId, artistId, pinned);
    return;
  }

  await insertAccountArtistId(accountId, artistId, pinned);
}
