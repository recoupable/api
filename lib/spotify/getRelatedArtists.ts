import { SpotifyArtist } from "@/types/spotify.types";

/**
 * Fetches related artists for a given Spotify artist ID.
 *
 * @param artistId - The Spotify artist ID.
 * @param accessToken - A valid Spotify access token.
 * @returns An array of related SpotifyArtist objects, or null on failure.
 */
export async function getRelatedArtists(
  artistId: string,
  accessToken: string,
): Promise<SpotifyArtist[] | null> {
  try {
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { artists: SpotifyArtist[] };
    return data.artists ?? null;
  } catch (error) {
    console.error("Failed to fetch related artists:", error);
    return null;
  }
}
