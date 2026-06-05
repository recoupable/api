import { extractList } from "@/lib/research/songstats/extractList";
import { isRecord } from "@/lib/research/songstats/isRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";

/**
 * Maps SongStats catalog payload to albums. Primary filtering and paging are handled
 * upstream via `is_primary`, `limit`, and `offset` (see `buildArtistCatalogQuery`).
 */
export function normalizeArtistAlbums(data: unknown, _query?: Record<string, string>): unknown[] {
  const items = extractList(data, ["albums", "catalog", "results", "data", "items"]);
  return items.filter(isRecord).map(normalizeTrackRecord);
}
