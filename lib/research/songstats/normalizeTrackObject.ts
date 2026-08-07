import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";

/**
 * Unwraps and normalizes a single track object from a SongStats payload.
 */
export function normalizeTrackObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;
  return normalizeTrackRecord(record);
}
