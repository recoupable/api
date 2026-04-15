import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAccountParams } from "@/lib/accounts/validateAccountParams";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getArtistSegments } from "@/lib/artists/segments/getArtistSegments";
import { validateGetSegmentsQuery } from "@/lib/artists/segments/validateGetSegmentsQuery";

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

    const validatedParams = validateAccountParams(id);
    if (validatedParams instanceof NextResponse) {
      return validatedParams;
    }

    const authResult = await validateAuthContext(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const validatedQuery = validateGetSegmentsQuery(searchParams);
    if (validatedQuery instanceof NextResponse) {
      return validatedQuery;
    }

    const result = await getArtistSegments(validatedParams.id, validatedQuery);

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
