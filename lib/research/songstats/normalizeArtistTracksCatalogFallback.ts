import { extractList } from "@/lib/research/songstats/extractList";
import { filterCatalogItems } from "@/lib/research/songstats/filterCatalogItems";
import { isRecord } from "@/lib/research/songstats/isRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { parsePositiveLimit } from "@/lib/research/songstats/parsePositiveLimit";

const DEFAULT_FALLBACK_LIMIT = 50;

/**
 * When `/artists/top_tracks` is empty, maps a limited primary catalog slice to tracks.
 */
export function normalizeArtistTracksCatalogFallback(
  data: unknown,
  query?: Record<string, string>,
): unknown[] {
  const items = extractList(data, [
    "tracks",
    "catalog",
    "albums",
    "results",
    "data",
    "items",
  ]).filter(isRecord);
  const filtered = filterCatalogItems(items, false).map(normalizeTrackRecord);
  const limit = parsePositiveLimit(query?.limit) ?? DEFAULT_FALLBACK_LIMIT;
  return filtered.slice(0, limit);
}
