import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getArtist from "@/lib/spotify/getArtist";
import { enrichSearchedArtistProfile } from "@/lib/valuation/enrichSearchedArtistProfile";

/**
 * Fetch an artist's real Spotify profile and enrich its attached social +
 * avatar with it (chat#1889 row 16). Callers that don't already hold a
 * resolved SpotifyArtist (like resolveOrCreateArtist's create path, which
 * only has the id) use this; callers that do should call
 * enrichSearchedArtistProfile directly and skip the extra fetch.
 *
 * Best-effort: never throws — enrichment must not fail the artist add. The
 * social stays fixable in verify-socials if Spotify is unreachable.
 *
 * @param params.artistId - The artist account id whose social to enrich
 * @param params.spotifyArtistId - The Spotify artist id to fetch
 */
export async function enrichArtistSpotifyProfile(params: {
  artistId: string;
  spotifyArtistId: string;
}): Promise<void> {
  const { artistId, spotifyArtistId } = params;
  try {
    const token = await generateAccessToken();
    if (!token.access_token) return;

    const { artist: spotifyArtist } = await getArtist(spotifyArtistId, token.access_token);
    if (!spotifyArtist) return;

    await enrichSearchedArtistProfile({ artistId, spotifyArtistId, spotifyArtist });
  } catch (error) {
    console.error("Error enriching artist Spotify profile:", error);
  }
}
