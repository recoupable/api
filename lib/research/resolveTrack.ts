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
 * Uses Spotify search for accurate matching, then maps the ISRC
 * to a Chartmetric ID via their /track/isrc/{isrc} endpoint.
 *
 * Falls back to Chartmetric's own search if Spotify/ISRC lookup fails.
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

  const spotifyTrack = tracks[0];
  const isrc = spotifyTrack.external_ids?.isrc;

  if (isrc) {
    const cmId = await chartmetricIdFromIsrc(isrc);
    if (cmId) return { id: cmId };
  }

  const cmId = await chartmetricIdFromSpotify(spotifyTrack.id);
  if (cmId) return { id: cmId };

  return fallbackChartmetricSearch(q);
}

/** Extract a Chartmetric track ID from any response shape. */
function extractCmTrackId(data: unknown): string | null {
  if (!data) return null;

  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as Record<string, unknown>;
    const id = first.cm_track ?? first.id;
    if (id != null) return String(id);
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const id = obj.cm_track ?? obj.id;
    if (id != null) return String(id);
  }

  return null;
}

async function chartmetricIdFromIsrc(isrc: string): Promise<string | null> {
  const result = await proxyToChartmetric(`/track/isrc/${isrc}`);
  if (result.status !== 200) return null;
  return extractCmTrackId(result.data);
}

async function chartmetricIdFromSpotify(spotifyId: string): Promise<string | null> {
  const result = await proxyToChartmetric(`/track/spotify/${spotifyId}`);
  if (result.status !== 200) return null;
  return extractCmTrackId(result.data);
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
