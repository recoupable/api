import { selectSongArtists } from "@/lib/supabase/song_artists/selectSongArtists";
import { getDominantSongArtist } from "@/lib/songs/getDominantSongArtist";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

/**
 * Claim-time roster attach (chat#1850 P1): resolve the claimed songs'
 * canonical artist through the songs graph (ISRCs → song_artists → the
 * dominant artist account) and link it to the claiming account in
 * account_artist_ids. The link is an idempotent upsert, so re-attaching an
 * already-rostered artist is a no-op.
 *
 * Throws on any query or link failure — whether a failed attach may fail the
 * surrounding operation is the calling surface's decision (chat#1965).
 *
 * @param params.accountId - The claiming account (already authorized)
 * @param params.isrcs - The claimed catalog's song ISRCs
 * @returns The attached artist account id, or null when the song graph
 *   resolves no artist
 */
export async function attachCanonicalArtistToAccount(params: {
  accountId: string;
  isrcs: string[];
}): Promise<string | null> {
  const { accountId, isrcs } = params;
  if (isrcs.length === 0) return null;

  const links = await selectSongArtists({ songs: isrcs });
  const artistId = getDominantSongArtist(links);
  if (!artistId) return null;

  await insertAccountArtistId(accountId, artistId);
  return artistId;
}
