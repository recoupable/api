import { isRecord } from "@/lib/research/songstats/isRecord";
import { pickResearchId } from "@/lib/research/songstats/pickResearchId";

/**
 * Adds a normalized `id` to a track record from its SongStats identifiers.
 */
export function normalizeTrackRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickResearchId(value, ["songstats_track_id", "track_id", "id"]);
  return id ? { ...value, id } : value;
}
