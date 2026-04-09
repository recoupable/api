import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { deleteAccountArtistId } from "@/lib/supabase/account_artist_ids/deleteAccountArtistId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { deleteAccountById } from "@/lib/supabase/accounts/deleteAccountById";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";

export interface DeleteArtistParams {
  artistId: string;
  requesterAccountId: string;
}

export type DeleteArtistResult =
  | { ok: true; artistId: string }
  | { ok: false; code: "forbidden" | "not_found" };

/**
 * Deletes an artist for the authenticated requester.
 *
 * The requester must be able to access the artist and must also have a direct
 * account_artist_ids link to remove. If the deleted link was the last remaining
 * artist link, the artist account itself is deleted as well.
 *
 * @param params - Delete artist parameters
 * @param params.artistId - Artist account ID to remove
 * @param params.requesterAccountId - Authenticated account performing the delete
 * @returns Delete result describing whether the artist was removed
 */
export async function deleteArtist({
  artistId,
  requesterAccountId,
}: DeleteArtistParams): Promise<DeleteArtistResult> {
  const existingArtist = await selectAccounts(artistId);
  if (!existingArtist.length) {
    return {
      ok: false,
      code: "not_found",
    };
  }

  const hasAccess = await checkAccountArtistAccess(requesterAccountId, artistId);
  if (!hasAccess) {
    return {
      ok: false,
      code: "forbidden",
    };
  }

  const deletedLinks = await deleteAccountArtistId(requesterAccountId, artistId);
  if (!deletedLinks.length) {
    return {
      ok: false,
      code: "forbidden",
    };
  }

  const remainingLinks = await getAccountArtistIds({
    artistIds: [artistId],
  });

  if (remainingLinks.length === 0) {
    await deleteAccountById(artistId);
  }

  return {
    ok: true,
    artistId,
  };
}
