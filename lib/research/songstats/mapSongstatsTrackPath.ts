import type { ProxyResult } from "@/lib/research/ProxyResult";
import { mapLegacyPlaylistScope } from "@/lib/research/songstats/mapLegacyPlaylistScope";
import { mapSongstatsResult } from "@/lib/research/songstats/mapSongstatsResult";
import { normalizeTopPlaylists } from "@/lib/research/songstats/normalizeTopPlaylists";
import { normalizeTrackLookupObject } from "@/lib/research/songstats/normalizeTrackLookupObject";
import { normalizeTrackObject } from "@/lib/research/songstats/normalizeTrackObject";
import { pickTopPlaylistsQuery } from "@/lib/research/songstats/pickTopPlaylistsQuery";

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
      "/tracks/top_playlists",
      {
        songstats_track_id: match[1],
        source: match[2],
        scope: mapLegacyPlaylistScope(match[3] as "current" | "past"),
        ...pickTopPlaylistsQuery(query),
      },
      normalizeTopPlaylists,
    );
  }

  return null;
}
