import getArtist from "@/lib/spotify/getArtist";
import { createArtistInDb } from "@/lib/artists/createArtistInDb";
import { updateArtistSocials } from "@/lib/artist/updateArtistSocials";
import { enrichSearchedArtistProfile } from "./enrichSearchedArtistProfile";

/**
 * Fallback roster attach for the valuation flow: when the ISRC → song_artists
 * graph can't resolve a canonical artist (attachCanonicalArtistToAccount
 * returned null — common for funnel signups whose songs aren't yet ingested
 * into song_artists), link the *searched* Spotify artist directly so the
 * account lands with a populated roster it can confirm. Server-side, account-
 * scoped version of the marketing funnel's old client-side linkArtistToAccount.
 *
 * Best-effort: never throws — a failed link must not fail the valuation.
 *
 * @param params.accountId - The owning account (already authorized)
 * @param params.spotifyArtistId - The searched Spotify artist id
 * @param params.accessToken - A Spotify app access token (client credentials)
 * @returns The linked artist account id, or null if nothing was linked
 */
export async function linkSearchedArtistToAccount(params: {
  accountId: string;
  spotifyArtistId: string;
  accessToken: string;
}): Promise<string | null> {
  const { accountId, spotifyArtistId, accessToken } = params;
  try {
    const { artist } = await getArtist(spotifyArtistId, accessToken);
    if (!artist?.name) return null;

    const created = await createArtistInDb(artist.name, accountId);
    if (!created?.account_id) return null;

    await updateArtistSocials(created.account_id, {
      SPOTIFY: `https://open.spotify.com/artist/${spotifyArtistId}`,
    });

    // Enrich the new artist with its real Spotify avatar + follower count so it
    // doesn't render as a blank avatar / "0 followers" (chat#1881 P1).
    await enrichSearchedArtistProfile({
      artistId: created.account_id,
      spotifyArtistId,
      spotifyArtist: artist,
    });

    return created.account_id;
  } catch (error) {
    console.error("Error linking searched artist to account:", error);
    return null;
  }
}
