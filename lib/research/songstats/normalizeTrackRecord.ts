import { isRecord } from "@/lib/research/songstats/isRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Adds a normalized `id` to a track record from its SongStats identifiers.
 */
export function normalizeTrackRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...value, id } : value;
}
