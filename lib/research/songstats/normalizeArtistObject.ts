import { firstRecord } from "@/lib/research/songstats/firstRecord";
import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";

/**
 * Unwraps and normalizes a single artist object from a SongStats payload.
 */
export function normalizeArtistObject(value: unknown): unknown {
  const record = firstRecord(value);
  if (!record) return value;
  return normalizeArtistRecord(record);
}
