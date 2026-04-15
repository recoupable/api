import { deleteAccountArtistId } from "@/lib/supabase/account_artist_ids/deleteAccountArtistId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { deleteAccountById } from "@/lib/supabase/accounts/deleteAccountById";

export interface DeleteArtistParams {
  artistId: string;
  requesterAccountId: string;
}

/**
 * Deletes an artist for an already validated requester.
 *
 * The validator is responsible for existence and access checks. This helper
 * only removes the direct owner link and deletes the artist account if that
 * link was the last remaining association.
 *
 * @param params - Delete artist parameters
 * @param params.artistId - Artist account ID to remove
 * @param params.requesterAccountId - Authenticated account performing the delete
 * @returns The deleted artist account ID
 */
export async function deleteArtist({
  artistId,
  requesterAccountId,
}: DeleteArtistParams): Promise<string> {
  const deletedLinks = await deleteAccountArtistId(requesterAccountId, artistId);
  if (!deletedLinks.length) {
    throw new Error("Failed to delete artist link");
  }

  const remainingLinks = await getAccountArtistIds({
    artistIds: [artistId],
  });

  if (remainingLinks.length === 0) {
    await deleteAccountById(artistId);
  }

  return artistId;
}
