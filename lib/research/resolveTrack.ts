import generateAccessToken from "@/lib/spotify/generateAccessToken";
import getSearch from "@/lib/spotify/getSearch";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import { resolveArtist } from "@/lib/research/resolveArtist";

/**
 * Resolves a track name (+ optional artist) to a Chartmetric track ID.
 *
 * Strategy: Spotify search finds the exact track name, then we look through
 * the artist's Chartmetric playlists to find the matching cm_track ID.
 * This avoids Chartmetric's unreliable text search entirely.
 */
export async function resolveTrack(
  q: string,
  artist?: string,
): Promise<{ id: string; error?: never } | { id?: never; error: string }> {
  const searchQuery = artist ? `${q} artist:${artist}` : q;

  const tokenResult = await generateAccessToken();
  if (tokenResult.error || !tokenResult.access_token) {
    return { error: "Failed to authenticate with Spotify" };
  }

  const { data, error } = await getSearch({
    q: searchQuery,
    type: "track",
    limit: 1,
    accessToken: tokenResult.access_token,
  });

  if (error || !data) {
    return { error: "Spotify search failed" };
  }

  interface SpotifyTrackItem {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
  }

  const tracks: SpotifyTrackItem[] = data?.tracks?.items ?? [];
  if (tracks.length === 0) {
    return { error: `No track found matching "${q}"${artist ? ` by ${artist}` : ""}` };
  }

  const spotifyTrack = tracks[0];
  const exactName = spotifyTrack.name;
  const artistName = artist || spotifyTrack.artists?.[0]?.name;

  if (!artistName) {
    return { error: `Found track "${exactName}" but could not determine artist` };
  }

  const resolved = await resolveArtist(artistName);
  if (resolved.error) {
    return { error: `Artist lookup failed: ${resolved.error}` };
  }

  const playlistsResult = await proxyToChartmetric(
    `/artist/${resolved.id}/spotify/current/playlists`,
    { editorial: "true", indie: "true", majorCurator: "true", popularIndie: "true", limit: "100" },
  );

  if (playlistsResult.status === 200 && Array.isArray(playlistsResult.data)) {
    const normalizedTarget = exactName.toLowerCase();
    for (const placement of playlistsResult.data as Array<Record<string, unknown>>) {
      const trackName = String(placement.track ?? "").toLowerCase();
      const cmTrack = placement.cm_track;
      if (cmTrack && trackName.includes(normalizedTarget)) {
        return { id: String(cmTrack) };
      }
    }
  }

  const tracksResult = await proxyToChartmetric(`/artist/${resolved.id}/tracks`);
  if (tracksResult.status === 200 && Array.isArray(tracksResult.data)) {
    const normalizedTarget = exactName.toLowerCase();
    for (const track of tracksResult.data as Array<Record<string, unknown>>) {
      const trackName = String(track.name ?? "").toLowerCase();
      const cmTrack = track.cm_track ?? track.id;
      if (cmTrack && trackName.includes(normalizedTarget)) {
        return { id: String(cmTrack) };
      }
    }
  }

  return { error: `Could not find Chartmetric ID for "${exactName}" by ${artistName}` };
}
