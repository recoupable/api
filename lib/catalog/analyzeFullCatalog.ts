import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { type CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { refineResults } from "./refineResults";

const BATCH_SIZE = 100;

export interface AnalyzeFullCatalogOptions {
  catalogId: string;
  criteria: string;
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
}: AnalyzeFullCatalogOptions): Promise<{
  results: CatalogSongWithArtists[];
  totalSongs: number;
  totalPages: number;
}> {
  // Fetch first page to get total count
  const firstPage = await selectCatalogSongsWithArtists({ catalogId, limit: BATCH_SIZE, page: 1 });
  const totalPages = Math.ceil(firstPage.total_count / BATCH_SIZE);
  const totalSongs = firstPage.total_count;

  // Fetch all pages in parallel
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  const pagePromises = pageNumbers.map(async pageNum =>
    pageNum === 1
      ? firstPage.songs
      : (await selectCatalogSongsWithArtists({ catalogId, page: pageNum, limit: BATCH_SIZE }))
          .songs,
  );

  const allPages = await Promise.all(pagePromises);
  const allSongs = allPages.flat();

  // Recursively filter and refine until results are under MAX_RESULTS
  const results = await refineResults(allSongs, criteria);

  return {
    results,
    totalSongs,
    totalPages,
  };
}
