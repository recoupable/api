import type { ProxyResult } from "@/lib/research/ProxyResult";
import {
  extractList,
  mapSongstatsResult,
  normalizeArtistObject,
  normalizeArtistRecord,
  normalizeUrlMap,
  UNSUPPORTED_RESULT,
} from "@/lib/research/songstats/songstatsResearchMapping";

const SONGSTATS_ARTIST_METRIC_SOURCE_BY_PLATFORM: Record<string, string> = {
  bandsintown: "bandsintown_followers",
  deezer: "deezer_fans",
  facebook: "facebook_likes",
  instagram: "instagram_followers",
  line: "line_followers",
  melon: "melon_followers",
  soundcloud: "soundcloud_followers",
  spotify: "spotify_streams",
  tiktok: "tiktok_followers",
  twitch: "twitch_followers",
  twitter: "twitter_followers",
  wikipedia: "wikipedia_views",
  youtube_artist: "youtube_artist_subscribers",
  youtube_channel: "youtube_channel_subscribers",
};

const SONGSTATS_ARTIST_STATS_SOURCE_BY_PLATFORM: Record<string, string> = {
  amazon: "amazon",
  bandsintown: "bandsintown",
  deezer: "deezer",
  facebook: "facebook",
  instagram: "instagram",
  radio: "radio",
  soundcloud: "soundcloud",
  spotify: "spotify",
  sxm: "sxm",
  tiktok: "tiktok",
  twitter: "twitter",
  youtube_artist: "youtube",
  youtube_channel: "youtube",
};

function mapArtistAudienceSource(source: string): string {
  return SONGSTATS_ARTIST_METRIC_SOURCE_BY_PLATFORM[source] || source;
}

function mapArtistStatsSource(source: string): string {
  return SONGSTATS_ARTIST_STATS_SOURCE_BY_PLATFORM[source] || source;
}

function parsePositiveLimit(value?: string): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

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
  match = path.match(/^\/artist\/([^/]+)\/artist-rank$/);
  if (match) {
    return Promise.resolve(UNSUPPORTED_RESULT);
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
