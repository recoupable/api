import type { CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { analyzeCatalogBatch } from "./analyzeCatalogBatch";

const BATCH_SIZE = 100;

/**
 * Processes batches of songs in parallel using AI filtering
 * Single Responsibility: Coordinate parallel batch processing
 *
 * @param songs - The songs to process
 * @param criteria - The criteria to use to process the songs
 * @returns The processed songs
 */
export async function processBatchesInParallel(
  songs: CatalogSongWithArtists[],
  criteria: string,
): Promise<CatalogSongWithArtists[]> {
  const batches = [];
  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    batches.push(songs.slice(i, i + BATCH_SIZE));
  }

  const batchPromises = batches.map(batch => analyzeCatalogBatch(batch, criteria));

  const results = await Promise.all(batchPromises);
  return results.flat();
}
