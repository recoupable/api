import type { ProxyResult } from "@/lib/research/providers/ProxyResult";
import { fetchSongstats } from "@/lib/songstats/fetchSongstats";

export type JsonRecord = Record<string, unknown>;

export const UNSUPPORTED_RESULT: ProxyResult = {
  status: 501,
  data: { error: "Research data source does not support this endpoint" },
};

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
}

export function extractList(value: unknown, keys: string[]): unknown[] {
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

export function normalizeArtistRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_artist_id", "artist_id", "id"]);
  return id ? { ...value, id } : value;
}

export function normalizeTrackRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...value, id } : value;
}

export function normalizeArtistObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;
  return normalizeArtistRecord(record);
}

export function normalizeTrackObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;

  const id = pickString(record, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...record, id } : record;
}

export function normalizeTrackLookupObject(value: unknown): unknown {
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

export function normalizeUrlMap(value: unknown): JsonRecord {
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

export async function mapSongstatsResult(
  endpoint: string,
  query?: Record<string, string>,
  normalize?: (value: unknown) => unknown,
): Promise<ProxyResult> {
  const result = await fetchSongstats(endpoint, query);
  if (result.status !== 200 || !normalize) return result;
  return { status: result.status, data: normalize(result.data) };
}

export function withoutLegacySearchParams(query?: Record<string, string>): Record<string, string> {
  return {
    q: query?.q || "",
    ...(query?.limit ? { limit: query.limit } : {}),
    ...(query?.offset ? { offset: query.offset } : {}),
  };
}
