import { shouldIncludeCatalogItem } from "@/lib/research/songstats/shouldIncludeCatalogItem";

/**
 * Filters a catalog list for primary-artist releases when `includeNonPrimary` is false.
 */
export function filterCatalogItems(items: unknown[], includeNonPrimary: boolean): unknown[] {
  return items.filter(item => shouldIncludeCatalogItem(item, includeNonPrimary));
}
