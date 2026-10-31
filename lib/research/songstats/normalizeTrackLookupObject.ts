import { normalizeTrackObject } from "@/lib/research/songstats/normalizeTrackObject";
import { isRecord } from "@/lib/research/songstats/isRecord";

/**
 * Normalizes a track lookup object, exposing both `id` and `songstats_track_ids`.
 */
export function normalizeTrackLookupObject(value: unknown): unknown {
  const record = normalizeTrackObject(value);
  if (!isRecord(record) || typeof record.id !== "string" || !record.id.trim()) return record;

  return {
    ...record,
    songstats_track_ids: [record.id],
  };
}
