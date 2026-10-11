import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";
import { isRecord } from "@/lib/research/songstats/isRecord";

/**
 * Unwraps and normalizes a single artist object from a SongStats payload.
 */
export function normalizeArtistObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;
  const normalized = normalizeArtistRecord(record);
  if (!isRecord(record.artist_info)) return normalized;
  const info = normalizeArtistRecord(record.artist_info);
  if (!isRecord(info) || typeof info.id !== "string" || !info.id.trim()) return normalized;
  return {
    ...record,
    id:
      isRecord(normalized) && typeof normalized.id === "string" && normalized.id.trim()
        ? normalized.id
        : info.id,
    artist_info: info,
  };
}
