import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { processSongsInput } from "@/lib/songs/processSongsInput";
import { SongInput } from "@/lib/songs/formatSongsInput";
import { CatalogSongWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";

export interface InsertCatalogSongsInput {
  catalog_id: string;
  isrc: string;
  name?: string;
  album?: string;
  notes?: string;
  artists?: string[];
}

export interface InsertCatalogSongsResult {
  songs: CatalogSongWithArtists[];
  pagination: {
    total_count: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Adds songs to a catalog by ISRC in batch.
 *
 * @param songs - Array of songs to add to catalog(s)
 * @returns The created catalog songs with artist information
 */
export async function insertCatalogSongsFunction(
  songs: InsertCatalogSongsInput[],
): Promise<InsertCatalogSongsResult> {
  // Get unique ISRCs and create song records with CSV data preserved
  const dataByIsrc = songs.reduce((map, song) => {
    if (song.isrc) {
      map.set(song.isrc, {
        name: song.name || "",
        album: song.album || "",
        notes: song.notes || "",
        artists: Array.isArray(song.artists) ? song.artists : undefined,
      });
    }
    return map;
  }, new Map<string, { name: string; album: string; notes: string; artists?: string[] }>());

  // Convert to SongInput format for processSongsInput
  const songsToProcess: SongInput[] = Array.from(dataByIsrc.entries()).map(([isrc, csvData]) => ({
    isrc,
    ...csvData,
  }));

  await processSongsInput(songsToProcess);

  // Insert catalog_songs relationships
  await insertCatalogSongs(
    songs.map(song => ({
      catalog: song.catalog_id,
      song: song.isrc,
    })),
  );

  // Get unique catalog IDs for fetching the created relationships
  const uniqueCatalogIds = [...new Set(songs.map(song => song.catalog_id))];

  // Fetch the created catalog songs with artist information
  const result = await selectCatalogSongsWithArtists({
    isrcs: Array.from(dataByIsrc.keys()),
  });

  // Filter to only include songs from the catalogs we just added to
  const filteredCatalogSongs = result.songs.filter(catalogSong =>
    uniqueCatalogIds.includes(catalogSong.catalog_id),
  );

  return {
    songs: filteredCatalogSongs,
    pagination: {
      total_count: filteredCatalogSongs.length,
      page: 1,
      limit: filteredCatalogSongs.length,
      total_pages: 1,
    },
  };
}
