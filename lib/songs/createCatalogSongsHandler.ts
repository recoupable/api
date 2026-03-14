import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { insertCatalogSongs } from "@/lib/supabase/catalog_songs/insertCatalogSongs";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { processSongsInput } from "@/lib/songs/processSongsInput";
import { SongInput } from "@/lib/songs/formatSongsInput";
import { validateCatalogSongsRequest } from "@/lib/songs/validateCatalogSongsRequest";

/**
 * Handler for creating catalog-song relationships.
 *
 * Behavior:
 * - Creates relationships in catalog_songs table for each {catalog_id, isrc} pair
 * - If either catalog_id or isrc is missing in any item, an error is returned
 * - Request accepts a bulk array under songs
 * - Returns the created catalog songs with artist information
 *
 * @param request - The request object containing the songs array in the body.
 * @returns A NextResponse with the created catalog songs.
 */
export async function createCatalogSongsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate request body
    const validatedBody = validateCatalogSongsRequest(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    // Get unique ISRCs and create song records with CSV data preserved
    const dataByIsrc = validatedBody.songs.reduce((map, song) => {
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
      validatedBody.songs.map(song => ({
        catalog: song.catalog_id,
        song: song.isrc,
      })),
    );

    // Get unique catalog IDs for fetching the created relationships
    const uniqueCatalogIds = [...new Set(validatedBody.songs.map(song => song.catalog_id))];

    // Fetch the created catalog songs with artist information
    const result = await selectCatalogSongsWithArtists({
      isrcs: Array.from(dataByIsrc.keys()),
    });

    // Filter to only include songs from the catalogs we just added to
    const filteredCatalogSongs = result.songs.filter(catalogSong =>
      uniqueCatalogIds.includes(catalogSong.catalog_id),
    );

    return NextResponse.json(
      {
        status: "success",
        songs: filteredCatalogSongs,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error creating catalog songs:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
