import { getCatalogSongs, CatalogSong } from "./getCatalogSongs";
import { formatCatalogSongsAsCSV } from "./formatCatalogSongsAsCSV";

/**
 * Get Catalog Data As CSV.
 *
 * @param catalogId - Parameter.
 * @returns - Result.
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
