import type { ProxyResult } from "@/lib/research/providers/ProxyResult";
import {
  extractList,
  mapSongstatsResult,
  normalizeTrackLookupObject,
  normalizeTrackObject,
} from "@/lib/research/songstats/songstatsResearchMapping";

export function mapSongstatsTrackPath(
  path: string,
  query?: Record<string, string>,
): Promise<ProxyResult> | null {
  let match = path.match(/^\/track\/isrc\/([^/]+)\/get-ids$/);
  if (match) {
    return mapSongstatsResult("/tracks/info", { isrc: match[1] }, normalizeTrackLookupObject);
  }

  match = path.match(/^\/track\/spotify\/([^/]+)\/get-ids$/);
  if (match) {
    return mapSongstatsResult(
      "/tracks/info",
      { spotify_track_id: match[1] },
      normalizeTrackLookupObject,
    );
  }

  match = path.match(/^\/track\/([^/]+)$/);
  if (match) {
    return mapSongstatsResult(
      "/tracks/info",
      { songstats_track_id: match[1] },
      normalizeTrackObject,
    );
  }

  match = path.match(/^\/track\/([^/]+)\/([^/]+)\/(current|past)\/playlists$/);
  if (match) {
    return mapSongstatsResult(
      "/tracks/activities",
      {
        songstats_track_id: match[1],
        source: match[2],
        status: match[3],
        ...query,
      },
      data => extractList(data, ["playlists", "activities", "results", "data", "items"]),
    );
  }

  return null;
}
