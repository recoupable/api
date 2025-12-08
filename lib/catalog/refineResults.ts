import { processBatchesInParallel } from "./processBatchesInParallel";
import { type CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";

const MAX_RESULTS = 1000;

/**
 * Recursively filters song selection until results are under MAX_RESULTS
 * Single Responsibility: Ensure result count stays within LLM context limits
 *
 * @param songs - The songs to refine
 * @param criteria - The criteria to use to refine the songs
 * @returns The refined songs
 */
export async function refineResults(
  songs: CatalogSongWithArtists[],
  criteria: string,
): Promise<CatalogSongWithArtists[]> {
  if (songs.length <= MAX_RESULTS) return songs;

  // Process in parallel batches - AI naturally selects best matches from whatever set it's given
  const filtered = await processBatchesInParallel(songs, criteria);

  // Recursively refine if still too many
  return refineResults(filtered, criteria);
}
