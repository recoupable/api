import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSegments } from "@/lib/artists/segments/getArtistSegments";
import { validateGetArtistSegmentsRequest } from "@/lib/artists/segments/validateGetArtistSegmentsRequest";

/**
 * Handler for GET /api/artists/{id}/segments.
 *
 * Returns paginated segments for the artist identified by the `{id}` path
 * parameter. Authentication is required; the artist ID is read from the path
 * and `page` / `limit` from the query string.
 *
 * @param request - The incoming request
 * @param params - Route params containing the artist account ID
 * @returns A NextResponse with segments and pagination metadata.
 */
export async function getArtistSegmentsHandler(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<NextResponse> {
  try {
    const { id } = await params;

    const validated = await validateGetArtistSegmentsRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await getArtistSegments(validated.artistId, validated.query);

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
