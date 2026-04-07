import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";

interface SpotifyTrackItem {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  external_ids?: { isrc?: string };
}

/**
 * Resolves a track name (+ optional artist) to a Chartmetric track ID.
 *
 * Uses Spotify search for accurate matching, then maps the Spotify track ID
 * to a Chartmetric ID via their /track/spotify/{id} endpoint.
 *
 * Falls back to Chartmetric's own search if Spotify lookup fails.
 */
export async function resolveTrack(
  q: string,
  artist?: string,
): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  const searchQuery = artist ? `${q} artist:${artist}` : q;

  const tokenResult = await generateAccessToken();
  if (tokenResult.error || !tokenResult.access_token) {
    return fallbackChartmetricSearch(q);
  }

  const { data, error } = await getSearch({
    q: searchQuery,
    type: "track",
    limit: 1,
    accessToken: tokenResult.access_token,
  });

  if (error || !data) {
    return fallbackChartmetricSearch(q);
  }

  const tracks: SpotifyTrackItem[] = data?.tracks?.items ?? [];
  if (tracks.length === 0) {
    return { error: `No track found matching "${q}"${artist ? ` by ${artist}` : ""}` };
  }

  const spotifyTrackId = tracks[0].id;

  const cmResult = await proxyToChartmetric(`/track/spotify/${spotifyTrackId}`);
  if (cmResult.status === 200 && cmResult.data) {
    const cmData = cmResult.data as { id?: number } | Array<{ id?: number }>;
    const cmId = Array.isArray(cmData) ? cmData[0]?.id : cmData.id;
    if (cmId) {
      return { id: String(cmId) };
    }
  }

  return fallbackChartmetricSearch(q);
}

async function fallbackChartmetricSearch(
  q: string,
): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  const result = await proxyToChartmetric("/search", {
    q,
    type: "tracks",
    limit: "1",
  });

  if (result.status !== 200) {
    return { error: `Track search failed with status ${result.status}` };
  }

  const tracks = (result.data as { tracks?: Array<{ id: number }> })?.tracks;
  if (!tracks || tracks.length === 0) {
    return { error: `No track found matching "${q}"` };
  }

  return { id: String(tracks[0].id) };
}
