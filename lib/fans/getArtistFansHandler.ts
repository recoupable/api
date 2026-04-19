import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getArtistFans } from "@/lib/fans/getArtistFans";
import { validateGetArtistFansRequest } from "@/lib/fans/validateGetArtistFansRequest";

/**
 * Handler for GET /api/artists/{id}/fans.
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
