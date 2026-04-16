import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchAlbumsRequest } from "@/lib/research/validateGetResearchAlbumsRequest";

/**
 * GET /api/research/albums
 *
 * Returns the album discography for the given Chartmetric `artist_id`. Thin
 * proxy over Chartmetric's `/artist/:id/albums`; discovery by name is the
 * caller's job via `GET /api/research?type=artists&beta=true`.
 *
 * @param request - must include numeric `artist_id` query param
 * @returns JSON album list or error
 */
export async function getResearchAlbumsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchAlbumsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/artist/${validated.artistId}/albums`,
    });

    if ("error" in result) return errorResponse("Failed to fetch artist albums", result.status);
    return successResponse({ albums: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchAlbumsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
