import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { type CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { refineResults } from "./refineResults";

const BATCH_SIZE = 100;
const MAX_PAGES_PER_SEARCH = 10;

export interface AnalyzeFullCatalogOptions {
  catalogId: string;
  criteria: string;
  startPage?: number;
}

/**
 * Fetches all songs from a catalog and filters them using AI in parallel batches
 * Following Open-Closed Principle: open for extension (custom filtering logic), closed for modification
 *
 * @param catalog - The catalog to analyze
 * @param catalog.catalogId - The ID of the catalog to analyze
 * @param catalog.criteria - The criteria to use to filter the songs
 * @returns The results of the analysis
 */
export async function analyzeFullCatalog({
  catalogId,
  criteria,
  startPage = 1,
}: AnalyzeFullCatalogOptions): Promise<{
  results: CatalogSongWithArtists[];
  totalSongs: number;
  totalPages: number;
  nextPage?: number;
}> {
  // Fetch first page to get total count
  const firstPage = await selectCatalogSongsWithArtists({
    catalogId,
    limit: BATCH_SIZE,
    page: startPage,
  });
  const totalPages = Math.ceil(firstPage.total_count / BATCH_SIZE);
  const totalSongs = firstPage.total_count;

  // Fetch one bounded window of pages in parallel
  const pageCount = Math.max(0, Math.min(MAX_PAGES_PER_SEARCH, totalPages - startPage + 1));
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + startPage);
  const pagePromises = pageNumbers.map(async pageNum =>
    pageNum === startPage
      ? firstPage.songs
      : (await selectCatalogSongsWithArtists({ catalogId, page: pageNum, limit: BATCH_SIZE }))
          .songs,
  );

  const allPages = await Promise.all(pagePromises);
  const allSongs = allPages.flat();

  // Apply criteria to every batch once before limiting the matching results.
  const results = await refineResults(allSongs, criteria);

  return {
    results,
    totalSongs,
    totalPages,
    ...(startPage + pageCount <= totalPages ? { nextPage: startPage + pageCount } : {}),
  };
}
