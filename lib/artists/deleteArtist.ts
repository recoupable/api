import { deleteAccountArtistId } from "@/lib/supabase/account_artist_ids/deleteAccountArtistId";
import { getAccountArtistIds } from "@/lib/supabase/account_artist_ids/getAccountArtistIds";
import { deleteAccountById } from "@/lib/supabase/accounts/deleteAccountById";
import { selectSongArtistsByArtist } from "@/lib/supabase/song_artists/selectSongArtistsByArtist";

export interface DeleteArtistParams {
  artistId: string;
  requesterAccountId: string;
}

/**
 * Deletes an artist for an already validated requester.
 *
 * The validator is responsible for existence and access checks. This helper
 * only removes the direct owner link and deletes the artist account if that
 * link was the last remaining association AND the canonical artist has no
 * song dependencies. account_artist_ids.artist_id cascades on account delete,
 * so hard-deleting a canonical with song_artists rows would destroy the song
 * graph shared across customers — in that case only the caller's link is
 * removed and the canonical account is kept.
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
    const songArtists = await selectSongArtistsByArtist(artistId);
    // Fail closed: a null (query error) is treated as "has dependencies" so an
    // unknown state never hard-deletes a canonical that may own a song graph.
    const hasSongDependencies = songArtists === null || songArtists.length > 0;
    if (!hasSongDependencies) {
      await deleteAccountById(artistId);
    }
  }

  return artistId;
}
