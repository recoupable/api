import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSegments } from "@/lib/artist/getArtistSegments";
import { validateArtistSegmentsQuery } from "@/lib/artist/validateArtistSegmentsQuery";

/**
 * Handler for retrieving artist segments with pagination.
 *
 * Parameters:
 * - artist_account_id (required): The unique identifier of the artist account
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Number of segments per page (default: 20, max: 100)
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with segments and pagination metadata.
 */
export async function getArtistSegmentsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const validatedQuery = validateArtistSegmentsQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const result = await getArtistSegments(validatedQuery);

    const statusCode = result.status === "success" ? 200 : 500;

    return NextResponse.json(result, {
      status: statusCode,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[ERROR] getArtistSegmentsHandler error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "An unknown error occurred",
        segments: [],
        pagination: {
          total_count: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
        },
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
