import { getCatalogSongs, CatalogSong } from "./getCatalogSongs";
import { formatCatalogSongsAsCSV } from "./formatCatalogSongsAsCSV";

/**
 * Gets all catalog songs and formats them as CSV for the scorer.
 * Paginates through all pages of results before formatting.
 *
 * @param catalogId - The ID of the catalog to fetch songs from
 * @returns A CSV-formatted string of all songs in the catalog
 */
export async function getCatalogDataAsCSV(catalogId: string): Promise<string> {
  const allSongs: CatalogSong[] = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    do {
      const response = await getCatalogSongs(catalogId, 100, currentPage);

      // Add songs from this page to our collection
      allSongs.push(...response.songs);

      // Update pagination info
      totalPages = response.pagination.total_pages;
      currentPage++;
    } while (currentPage <= totalPages);

    return formatCatalogSongsAsCSV(allSongs);
  } catch (error) {
    console.error("Error fetching all catalog songs:", error);
    throw error;
  }
}
