import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { isRecord } from "@/lib/research/songstats/isRecord";

/**
 * Unwraps and normalizes a single track object from a SongStats payload.
 */
export function normalizeTrackObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;

  const normalized = normalizeTrackRecord(record);
  if (!isRecord(record.track_info)) return normalized;
  const info = normalizeTrackRecord(record.track_info);
  if (!isRecord(info) || typeof info.id !== "string" || !info.id.trim()) return normalized;
  return {
    ...record,
    id:
      isRecord(normalized) && typeof normalized.id === "string" && normalized.id.trim()
        ? normalized.id
        : info.id,
    track_info: info,
  };
}
