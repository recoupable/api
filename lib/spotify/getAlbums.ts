export type SpotifyAlbum = {
  id: string;
  name?: string;
  release_date?: string;
  images?: Array<{ url: string; height?: number | null; width?: number | null }>;
};

// Spotify's GET /v1/albums caps ids at 20 per request.
const BATCH_SIZE = 20;

/**
 * Fetch several Spotify albums by id via the batch endpoint (20 ids per
 * request), instead of one GET /v1/albums/{id} call each.
 *
 * @param params.ids - Spotify album ids
 * @param params.accessToken - Client-credentials access token
 */
const getAlbums = async ({
  ids,
  accessToken,
}: {
  ids: string[];
  accessToken: string;
}): Promise<{ albums: SpotifyAlbum[]; error: null } | { albums: null; error: Error }> => {
  try {
    const albums: SpotifyAlbum[] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const url = `https://api.spotify.com/v1/albums?ids=${encodeURIComponent(batch.join(","))}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return { albums: null, error: new Error("Spotify API request failed") };
      }

      const data = await response.json();
      albums.push(...((data.albums ?? []).filter(Boolean) as SpotifyAlbum[]));
    }
    return { albums, error: null };
  } catch (error) {
    console.error(error);
    return {
      albums: null,
      error: error instanceof Error ? error : new Error("Unknown error fetching albums"),
    };
  }
};

export default getAlbums;
