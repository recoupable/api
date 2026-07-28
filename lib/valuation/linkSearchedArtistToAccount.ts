import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { findCanonicalArtistBySpotifyId } from "@/lib/valuation/findCanonicalArtistBySpotifyId";
import { selectAccountArtistId } from "@/lib/supabase/account_artist_ids/selectAccountArtistId";
import { insertAccountArtistId } from "@/lib/supabase/account_artist_ids/insertAccountArtistId";

/**
 * Fallback roster attach for the valuation flow: when the ISRC → song_artists
 * graph can't resolve a canonical artist (attachCanonicalArtistToAccount
 * returned null — funnel signups whose songs aren't yet in song_artists), link
 * the *searched* Spotify artist directly so the account lands with a populated
 * roster it can confirm. Server-side, account-scoped version of the marketing
 * funnel's old client-side linkArtistToAccount.
 *
 * Reuses the canonical artist when one already carries this Spotify id, and
 * only creates when none does. Artists are canonical and shared —
 * `account_artist_ids` is the join that lets many accounts roster the same
 * artist (chat#1866) — so creating unconditionally minted a duplicate for
 * every account whose first artist was added this way (chat#1889 row 8).
 *
 * Link-only: the caller resolves the Spotify profile once and enriches the
 * returned artist separately (runValuationHandler → enrichSearchedArtistProfile),
 * so enrichment covers both the canonical and fallback paths (chat#1881 2a).
 *
 * Best-effort: never throws — a failed link must not fail the valuation.
 *
 * @param params.accountId - The owning account (already authorized)
 * @param params.spotifyArtistId - The searched Spotify artist id
 * @param params.artistName - The searched artist's display name (from Spotify)
 * @returns The linked artist account id, or null if nothing was linked
 */
export async function linkSearchedArtistToAccount(params: {
  accountId: string;
  spotifyArtistId: string;
  artistName: string;
}): Promise<string | null> {
  const { accountId, spotifyArtistId, artistName } = params;
  try {
    if (!artistName) return null;

    const canonicalId = await findCanonicalArtistBySpotifyId(spotifyArtistId);
    if (canonicalId) {
      const alreadyRostered = await selectAccountArtistId(accountId, canonicalId);
      if (!alreadyRostered) {
        await insertAccountArtistId(accountId, canonicalId);
      }
      return canonicalId;
    }

    const created = await createArtistInDb(artistName, accountId);
    if (!created?.account_id) return null;

    await updateArtistSocials(created.account_id, {
      SPOTIFY: `https://open.spotify.com/artist/${spotifyArtistId}`,
    });

    return created.account_id;
  } catch (error) {
    console.error("Error linking searched artist to account:", error);
    return null;
  }
}
