import type { ProxyResult } from "@/lib/research/providers/ProxyResult";
import {
  extractList,
  mapSongstatsResult,
  normalizeArtistObject,
  normalizeUrlMap,
} from "@/lib/research/songstats/songstatsResearchMapping";

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
      data => extractList(data, ["albums", "catalog", "tracks", "results", "data", "items"]),
    );
  }

  match = path.match(/^\/artist\/([^/]+)\/tracks$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/catalog",
      { songstats_artist_id: match[1], ...query },
      data => extractList(data, ["tracks", "catalog", "results", "data", "items"]),
    );
  }

  match = path.match(/^\/artist\/([^/]+)\/stat\/([^/]+)$/);
  if (match) {
    return mapSongstatsResult("/artists/stats", {
      songstats_artist_id: match[1],
      source: match[2],
      ...query,
    });
  }

  match = path.match(/^\/artist\/([^/]+)\/([^/]+)-audience-stats$/);
  if (match) {
    return mapSongstatsResult("/artists/audience", {
      songstats_artist_id: match[1],
      source: match[2],
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
  match = path.match(/^\/artist\/([^/]+)\/artist-rank$/);
  if (match) {
    return mapSongstatsResult("/artists/stats", { songstats_artist_id: match[1], ...query });
  }
  match = path.match(/^\/artist\/([^/]+)\/([^/]+)\/(current|past)\/playlists$/);
  if (match) {
    return mapSongstatsResult(
      "/artists/top_playlists",
      {
        songstats_artist_id: match[1],
        source: match[2],
        status: match[3],
        ...query,
      },
      data => extractList(data, ["playlists", "results", "data", "items"]),
    );
  }

  return null;
}
