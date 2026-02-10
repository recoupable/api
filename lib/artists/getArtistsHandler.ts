import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateGetArtistsRequest } from "@/lib/artists/validateGetArtistsRequest";
import { getArtists } from "@/lib/artists/getArtists";

/**
 * Handler for retrieving artists with authentication and organization filtering.
 *
 * Requires authentication via x-api-key or Authorization bearer token.
 *
 * Query parameters:
 * - account_id (optional): Filter to a specific account (org/admin keys only)
 * - organization_id (optional): Filter to artists in a specific organization
 *
 * @param request - The request object
 * @returns A NextResponse with artists data
 */
export async function getArtistsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetArtistsRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const artists = await getArtists(validated);

    return NextResponse.json(
      {
        status: "success",
        artists,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] getArtistsHandler:", error);
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
