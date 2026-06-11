import { SpotifyTrack } from "@/types/spotify.types";

const BATCH_SIZE = 50;
const MAX_429_RETRIES = 3;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch multiple tracks by id via `GET /v1/tracks` (the only public surface
 * that returns `external_ids.isrc`), batched at the API's 50-id limit.
 * Rate limits (429) back off per Spotify's Retry-After and retry up to
 * 3 times per batch — portfolio-scale capture bursts hit them routinely.
 *
 * @param params.ids - Spotify track ids
 * @param params.accessToken - Client-credentials access token
 * @returns All fetched tracks, or an error
 */
const getTracks = async ({
  ids,
  accessToken,
}: {
  ids: string[];
  accessToken: string;
}): Promise<{ tracks: SpotifyTrack[] | null; error: Error | null }> => {
  if (ids.length === 0) return { tracks: [], error: null };

  try {
    const tracks: SpotifyTrack[] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const url = `https://api.spotify.com/v1/tracks?ids=${encodeURIComponent(batch.join(","))}`;

      let response: Response | null = null;
      for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
        response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (response.status !== 429) break;
        if (attempt < MAX_429_RETRIES) {
          // Spotify sends Retry-After in seconds on rate limits
          const retryAfter = Number(response.headers.get("Retry-After")) || 1;
          await delay(retryAfter * 1000);
        }
      }

      if (!response || !response.ok) {
        return {
          tracks: null,
          error: new Error(`Spotify tracks request failed: ${response?.status}`),
        };
      }

      const data = await response.json();
      tracks.push(...(data.tracks ?? []).filter(Boolean));
    }
    return { tracks, error: null };
  } catch (error) {
    console.error(error);
    return {
      tracks: null,
      error: error instanceof Error ? error : new Error("Unknown error fetching tracks"),
    };
  }
};

export default getTracks;
