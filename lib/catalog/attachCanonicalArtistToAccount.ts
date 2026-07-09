import { selectSongArtistsBySongs } from "@/lib/supabase/song_artists/selectSongArtistsBySongs";
import { getDominantSongArtist } from "@/lib/songs/getDominantSongArtist";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

/**
 * Claim-time roster attach (chat#1850 P1): resolve the claimed songs'
 * canonical artist through the songs graph (ISRCs → song_artists → the
 * dominant artist account) and link it to the claiming account in
 * account_artist_ids when absent. This replaces the marketing funnel's
 * per-signup artist creation — which minted duplicate, song-less roster
 * artists — as the roster source of truth for funnel signups.
 *
 * Best-effort: never throws, a failed attach must not fail the claim.
 *
 * @param params.accountId - The claiming account (already authorized)
 * @param params.isrcs - The claimed catalog's song ISRCs
 * @returns The attached (or already-linked) artist account id, or null
 */
export async function attachCanonicalArtistToAccount(params: {
  accountId: string;
  isrcs: string[];
}): Promise<string | null> {
  const { accountId, isrcs } = params;
  try {
    if (isrcs.length === 0) return null;

    const links = await selectSongArtistsBySongs(isrcs);
    const artistId = getDominantSongArtist(links);
    if (!artistId) return null;

    const existing = await selectAccountArtistId(accountId, artistId);
    if (!existing) {
      await insertAccountArtistId(accountId, artistId);
    }
    return artistId;
  } catch (error) {
    console.error("Error attaching canonical artist to account:", error);
    return null;
  }
}
