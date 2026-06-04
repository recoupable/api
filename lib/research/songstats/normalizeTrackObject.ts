import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Unwraps and normalizes a single track object from a SongStats payload.
 */
export function normalizeTrackObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;

  const id = pickString(record, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...record, id } : record;
}
