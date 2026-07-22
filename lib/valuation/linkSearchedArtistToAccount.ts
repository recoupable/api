import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";

/**
 * Fallback roster attach for the valuation flow: when the ISRC → song_artists
 * graph can't resolve a canonical artist (attachCanonicalArtistToAccount
 * returned null — funnel signups whose songs aren't yet in song_artists), link
 * the *searched* Spotify artist directly so the account lands with a populated
 * roster it can confirm. Server-side, account-scoped version of the marketing
 * funnel's old client-side linkArtistToAccount.
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
