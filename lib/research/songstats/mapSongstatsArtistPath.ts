import type { ProxyResult } from "@/lib/research/ProxyResult";
import { extractList } from "@/lib/research/songstats/extractList";
import { mapSongstatsResult } from "@/lib/research/songstats/mapSongstatsResult";
import { normalizeArtistObject } from "@/lib/research/songstats/normalizeArtistObject";
import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";
import { normalizeEntityRecord } from "@/lib/research/songstats/normalizeEntityRecord";
import { normalizeTopPlaylists } from "@/lib/research/songstats/normalizeTopPlaylists";
import { normalizeUrlMap } from "@/lib/research/songstats/normalizeUrlMap";
import { mapArtistAudienceSource } from "@/lib/research/songstats/mapArtistAudienceSource";
import { mapArtistStatsSource } from "@/lib/research/songstats/mapArtistStatsSource";
import { parsePositiveLimit } from "@/lib/research/songstats/parsePositiveLimit";

export function mapSongstatsArtistPath(
  path: string,
  query?: Record<string, string>,
): Promise<ProxyResult> | null {
  let match = path.match(/^\/artist\/spotify\/([^/]+)\/get-ids$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/info",
      { spotify_artist_id: match[1] },
      normalizeArtistObject,
    );
  }

  match = path.match(/^\/artist\/([^/]+)$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/info",
      { songstats_artist_id: match[1] },
      normalizeArtistObject,
    );
  }

  match = path.match(/^\/artist\/([^/]+)\/albums$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/catalog",
      { songstats_artist_id: match[1], ...query },
      data =>
        extractList(data, ["albums", "catalog", "tracks", "results", "data", "items"]).map(
          normalizeEntityRecord,
        ),
    );
  }

  match = path.match(/^\/artist\/([^/]+)\/tracks$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/catalog",
      { songstats_artist_id: match[1], ...query },
      data =>
        extractList(data, ["tracks", "catalog", "results", "data", "items"]).map(
          normalizeEntityRecord,
        ),
    );
  }

  match = path.match(/^\/artist\/([^/]+)\/stat\/([^/]+)$/);
  if (match) {
    return mapSongstatsResult("/artists/stats", {
      songstats_artist_id: match[1],
      source: mapArtistStatsSource(match[2]),
      ...query,
    });
  }

  match = path.match(/^\/artist\/([^/]+)\/([^/]+)-audience-stats$/);
  if (match) {
    return mapSongstatsResult("/artists/audience", {
      songstats_artist_id: match[1],
      source: mapArtistAudienceSource(match[2]),
      ...query,
    });
  }

  match = path.match(/^\/artist\/([^/]+)\/(career|milestones|noteworthy-insights)$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/activities",
      { songstats_artist_id: match[1], ...query },
      data => extractList(data, ["activities", "results", "data", "items"]),
    );
  }

  match = path.match(/^\/artist\/([^/]+)\/urls$/);
  if (match) {
    return mapSongstatsResult("/artists/info", { songstats_artist_id: match[1] }, normalizeUrlMap);
  }
  match = path.match(/^\/artist\/([^/]+)\/similar-artists\/by-configurations$/);
  if (match) {
    const limit = parsePositiveLimit(query?.limit);
    return mapSongstatsResult("/artists/info", { songstats_artist_id: match[1] }, data => {
      const relatedArtists = extractList(data, ["artist_info", "related_artists"]).map(
        normalizeArtistRecord,
      );
      return limit ? relatedArtists.slice(0, limit) : relatedArtists;
    });
  }

  match = path.match(/^\/artist\/([^/]+)\/([^/]+)\/(current|past)\/playlists$/);
  if (match) {
    // SongStats top_playlists is scoped by a time window, not the legacy
    // current/past status: map current -> current placements, past -> all-time.
    return mapSongstatsResult(
      "/artists/top_playlists",
      {
        songstats_artist_id: match[1],
        source: match[2],
        scope: match[3] === "past" ? "total" : "current",
        ...query,
      },
      normalizeTopPlaylists,
    );
  }

  return null;
}
