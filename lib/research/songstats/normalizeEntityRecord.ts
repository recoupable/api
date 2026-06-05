import { isRecord } from "@/lib/research/songstats/isRecord";
import { normalizeArtistRecord } from "@/lib/research/songstats/normalizeArtistRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Normalizes a catalog/search row that may be a track or artist object.
 */
export function normalizeEntityRecord(value: unknown): unknown {
  if (!isRecord(value)) return value;

  if (pickString(value, ["songstats_track_id", "track_id"])) {
    return normalizeTrackRecord(value);
  }

  if (pickString(value, ["songstats_artist_id", "artist_id", "id"])) {
    return normalizeArtistRecord(value);
  }

  return value;
}
