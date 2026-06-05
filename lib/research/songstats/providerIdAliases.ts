import type { JsonRecord } from "@/lib/research/songstats/isRecord";

/** SongStats / legacy keys stripped from public payloads once `id` is set. */
export const PROVIDER_ARTIST_ID_ALIASES = ["songstats_artist_id", "artist_id"] as const;

export const PROVIDER_TRACK_ID_ALIASES = [
  "songstats_track_id",
  "track_id",
  "songstats_track_ids",
] as const;

/**
 * Returns a shallow copy of `record` without the given keys.
 */
export function omitKeys(record: JsonRecord, keys: readonly string[]): JsonRecord {
  const next = { ...record };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}
