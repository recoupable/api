import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getArtistFans } from "@/lib/fans/getArtistFans";
import { validateGetArtistFansRequest } from "@/lib/fans/validateGetArtistFansRequest";

/**
 * Handler for GET /api/artists/{id}/fans.
 *
 * Returns paginated fans for the artist, ordered by most recent engagement.
 * Auth is required; `validateGetArtistFansRequest` enforces it and returns
 * the 401/400 NextResponse directly.
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

    return NextResponse.json(result, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getArtistFansHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
