import { extractList } from "@/lib/research/songstats/extractList";
import { filterCatalogItems } from "@/lib/research/songstats/filterCatalogItems";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { parsePositiveLimit } from "@/lib/research/songstats/parsePositiveLimit";

/**
 * Maps SongStats catalog payload to a filtered album list (primary releases by default).
 */
export function normalizeArtistAlbums(
  data: unknown,
  query?: Record<string, string>,
): unknown[] {
  const includeNonPrimary = query?.isPrimary === "false";
  const items = extractList(data, ["albums", "catalog", "results", "data", "items"]);
  const filtered = filterCatalogItems(items, includeNonPrimary).map(normalizeTrackRecord);

  const limit = parsePositiveLimit(query?.limit);
  return limit ? filtered.slice(0, limit) : filtered;
}
