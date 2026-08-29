import { isRecord } from "@/lib/research/songstats/isRecord";
import { normalizeAlbumRecord } from "@/lib/research/songstats/normalizeAlbumRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { pickString } from "@/lib/research/songstats/pickString";

/**
 * Normalizes a row from `/artist/:id/albums` catalog payloads.
 * Track-shaped rows (remix/feature noise) are normalized as tracks; everything else as albums.
 */
export function normalizeAlbumsCatalogItem(value: unknown): unknown {
  if (!isRecord(value)) return value;

  if (pickString(value, ["songstats_track_id", "track_id"])) {
    return normalizeTrackRecord(value);
  }

  return normalizeAlbumRecord(value);
}
