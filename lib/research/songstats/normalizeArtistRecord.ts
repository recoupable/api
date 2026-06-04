import { isRecord } from "@/lib/research/songstats/isRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Adds a normalized `id` to an artist record from its SongStats identifiers.
 */
export function normalizeArtistRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const id = pickString(value, ["songstats_artist_id", "artist_id", "id"]);
  return id ? { ...value, id } : value;
}
