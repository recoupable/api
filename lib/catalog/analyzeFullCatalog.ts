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
 * Analyze up to ten 100-track pages, starting at the one-based startPage.
 * A nextPage value resumes the search when additional catalog rows remain.
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
    page: 1,
  });
  const totalPages = Math.ceil(firstPage.total_count / BATCH_SIZE);
  const totalSongs = firstPage.total_count;

  // Fetch one bounded window of pages in parallel
  const pageCount = Math.max(0, Math.min(MAX_PAGES_PER_SEARCH, totalPages - startPage + 1));
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + startPage);
  const pagePromises = pageNumbers.map(async pageNum =>
    pageNum === 1
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
