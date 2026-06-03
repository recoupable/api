import { fetchSongstats } from "@/lib/songstats/fetchSongstats";

interface ProxyResult {
  data: unknown;
  status: number;
}

type JsonRecord = Record<string, unknown>;

const UNSUPPORTED_RESULT: ProxyResult = {
  status: 501,
  data: { error: "Research data source does not support this endpoint" },
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
}

function extractList(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const key of keys) {
    const child = value[key];
    if (Array.isArray(child)) return child;
    if (isRecord(child)) {
      const nested = extractList(child, keys);
      if (nested.length) return nested;
    }
  }

  return [];
}

function pickString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }

  return undefined;
}

function normalizeArtistRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_artist_id", "artist_id", "id"]);
  return id ? { ...value, id } : value;
}

function normalizeTrackRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...value, id } : value;
}

function normalizeArtistObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;
  return normalizeArtistRecord(record);
}

function normalizeTrackObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;

  const id = pickString(record, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...record, id } : record;
}

function normalizeTrackLookupObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;

  const id = pickString(record, ["songstats_track_id", "track_id", "id"]);
  if (!id) return record;

  return {
    ...record,
    id,
    songstats_track_ids: [id],
  };
}

function normalizeUrlMap(value: unknown): JsonRecord {
  const urls: JsonRecord = {};

  const visit = (current: unknown, keyHint?: string): void => {
    if (typeof current === "string") {
      if (/^https?:\/\//i.test(current)) urls[keyHint || current] = current;
      return;
    }

    if (Array.isArray(current)) {
      for (const item of current) visit(item, keyHint);
      return;
    }

    if (!isRecord(current)) return;

    const platform = pickString(current, ["platform", "source", "type", "name", "domain"]);
    const url = pickString(current, ["url", "link", "href"]);
    if (url && /^https?:\/\//i.test(url)) {
      urls[platform || url] = url;
    }

    for (const [key, child] of Object.entries(current)) {
      visit(child, key);
    }
  };

  visit(value);
  return urls;
}

async function mapSongstatsResult(
  endpoint: string,
  query?: Record<string, string>,
  normalize?: (value: unknown) => unknown,
): Promise<ProxyResult> {
  const result = await fetchSongstats(endpoint, query);
  if (result.status !== 200 || !normalize) return result;
  return { status: result.status, data: normalize(result.data) };
}

function withoutLegacySearchParams(query?: Record<string, string>): Record<string, string> {
  return {
    q: query?.q || "",
    ...(query?.limit ? { limit: query.limit } : {}),
    ...(query?.offset ? { offset: query.offset } : {}),
  };
}

function mapEntitySearch(
  path: string,
  query?: Record<string, string>,
): Promise<ProxyResult> | null {
  if (path !== "/search") return null;

  const type = (query?.type || "artists").toLowerCase();
  if (type === "artists" || type === "artist") {
    return mapSongstatsResult("/artists/search", withoutLegacySearchParams(query), data => ({
      artists: extractList(data, ["artists", "results", "data", "items"]).map(
        normalizeArtistRecord,
      ),
    }));
  }

  if (type === "tracks" || type === "track") {
    return mapSongstatsResult("/tracks/search", withoutLegacySearchParams(query), data => ({
      tracks: extractList(data, ["tracks", "results", "data", "items"]).map(normalizeTrackRecord),
    }));
  }

  if (type === "labels" || type === "label") {
    return mapSongstatsResult("/labels/search", withoutLegacySearchParams(query), data => ({
      labels: extractList(data, ["labels", "results", "data", "items"]),
    }));
  }

  return Promise.resolve(UNSUPPORTED_RESULT);
}

function mapArtistPath(path: string, query?: Record<string, string>): Promise<ProxyResult> | null {
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

function mapTrackPath(path: string, query?: Record<string, string>): Promise<ProxyResult> | null {
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

export async function fetchSongstatsResearch(
  path: string,
  query?: Record<string, string>,
): Promise<ProxyResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return (
    (await mapEntitySearch(normalizedPath, query)) ||
    (await mapArtistPath(normalizedPath, query)) ||
    (await mapTrackPath(normalizedPath, query)) ||
    UNSUPPORTED_RESULT
  );
}
