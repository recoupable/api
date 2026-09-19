import { processBatchesInParallel } from "./processBatchesInParallel";
import { type CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";

const MAX_RESULTS = 1000;

/**
 * Filters every song against the criteria once, then caps the matching results.
 * Preserves catalog order; the cap is not a global relevance ranking.
 *
 * @param songs - The songs to refine
 * @param criteria - The criteria to use to refine the songs
 * @returns The refined songs
 */
export async function refineResults(
  songs: CatalogSongWithArtists[],
  criteria: string,
): Promise<CatalogSongWithArtists[]> {
  if (songs.length === 0) return [];

  const filtered = await processBatchesInParallel(songs, criteria);

  // A broad brief may match every song. Limit in code rather than asking the
  // model to repeatedly reject valid matches with no guarantee of progress.
  return filtered.slice(0, MAX_RESULTS);
}
