import { extractList } from "@/lib/research/songstats/extractList";
import { filterCatalogItems } from "@/lib/research/songstats/filterCatalogItems";
import { isRecord } from "@/lib/research/songstats/isRecord";
import { normalizeTrackRecord } from "@/lib/research/songstats/normalizeTrackRecord";
import { resolveCatalogPrimary } from "@/lib/research/songstats/resolveCatalogPrimary";

/**
 * Maps SongStats catalog payload to albums. Upstream `is_primary` handles paging;
 * title/role noise is stripped client-side when primary mode is on.
 */
export function normalizeArtistAlbums(data: unknown, query?: Record<string, string>): unknown[] {
  const items = extractList(data, ["albums", "catalog", "results", "data", "items"]).filter(isRecord);
  const includeAll = resolveCatalogPrimary(query) === "false";
  const list = includeAll ? items : filterCatalogItems(items, false);
  return list.map(normalizeTrackRecord);
}
