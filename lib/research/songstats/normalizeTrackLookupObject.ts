import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Normalizes a track lookup object, exposing both `id` and `songstats_track_ids`.
 */
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
