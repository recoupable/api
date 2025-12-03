import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { deleteCatalogSongs } from "@/lib/supabase/catalog_songs/deleteCatalogSongs";
import { validateCatalogSongsRequest } from "@/lib/songs/validateCatalogSongsRequest";

/**
 * Handler for deleting catalog-song relationships.
 *
 * Behavior:
 * - Deletes relationships in catalog_songs table for each {catalog_id, isrc} pair
 * - If either catalog_id or isrc is missing in any item, an error is returned
 * - Request accepts a bulk array under songs
 * - Response structure is identical to GET and POST (songs array with pagination when applicable)
 *
 * @param request - The request object containing the songs array in the body.
 * @returns A NextResponse with the remaining catalog songs.
 */
export async function deleteCatalogSongsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Validate request body
    const validatedBody = validateCatalogSongsRequest(body);
    if (validatedBody instanceof NextResponse) {
      return validatedBody;
    }

    // Delete catalog_songs relationships
    const affectedCatalogIds = await deleteCatalogSongs(validatedBody.songs);

    // Get unique catalog IDs for fetching the remaining relationships
    const uniqueCatalogIds = [...new Set(affectedCatalogIds)];

    // Fetch the remaining catalog songs with artist information for the affected catalogs
    const remainingCatalogSongs = [];

    for (const catalogId of uniqueCatalogIds) {
      const result = await selectCatalogSongsWithArtists({
        catalogId,
      });

      remainingCatalogSongs.push(...result.songs);
    }

    return NextResponse.json(
      {
        status: "success",
        songs: remainingCatalogSongs,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error deleting catalog songs:", error);
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
