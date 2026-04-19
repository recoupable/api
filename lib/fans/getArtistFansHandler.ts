import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistFans } from "@/lib/fans/getArtistFans";
import { validateGetArtistFansRequest } from "@/lib/fans/validateGetArtistFansRequest";

/**
 * Handler for GET /api/artists/{id}/fans.
 *
 * Returns paginated fans (unique socials) derived from the artist's segments.
 * Auth is required; `validateGetArtistFansRequest` enforces auth internally.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route
 * @returns A NextResponse with the fans envelope or an error
 */
export async function getArtistFansHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    const validated = await validateGetArtistFansRequest(request, id);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const result = await getArtistFans({
      artistAccountId: validated.artistAccountId,
      page: validated.page,
      limit: validated.limit,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("[ERROR] getArtistFansHandler error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
        fans: [],
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
