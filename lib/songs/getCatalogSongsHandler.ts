import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectCatalogSongsWithArtists } from "@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists";
import { validateCatalogSongsQuery } from "@/lib/songs/validateCatalogSongsQuery";
import { authorizeCatalogAccess } from "@/lib/songs/authorizeCatalogAccess";

/**
 * Handler for retrieving catalog songs with pagination.
 *
 * Parameters:
 * - catalog_id (required): The unique identifier of the catalog to query songs for
 * - artistName (optional): Filter songs by artist name
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Number of songs per page (default: 20, max: 100)
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with songs and pagination metadata.
 */
export async function getCatalogSongsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateCatalogSongsQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    // Catalog songs are account-scoped (chat#1912 row 6, contract in
    // recoupable/docs#282): this read was previously open to anyone holding a
    // catalog id, while the sibling /measurements endpoint required credentials.
    const authorized = await authorizeCatalogAccess(request, [validatedQuery.catalog_id]);
    if (authorized instanceof NextResponse) return authorized;

    // Fetch catalog songs with pagination
    const result = await selectCatalogSongsWithArtists({
      catalogId: validatedQuery.catalog_id,
      artistName: validatedQuery.artistName,
      page: validatedQuery.page,
      limit: validatedQuery.limit,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(result.total_count / validatedQuery.limit);

    return NextResponse.json(
      {
        status: "success",
        songs: result.songs,
        pagination: {
          total_count: result.total_count,
          page: validatedQuery.page,
          limit: validatedQuery.limit,
          total_pages: totalPages,
        },
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("Error fetching catalog songs:", error);
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
