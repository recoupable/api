import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchAlbumsRequest } from "@/lib/research/validateGetResearchAlbumsRequest";

/**
 * GET /api/research/albums
 *
 * Returns the album discography for the given provider `artist_id`.
 *
 * @param request - must include `artist_id`; optional `is_primary`, `limit`, `offset`
 * @returns JSON album list or error
 */
export async function getResearchAlbumsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchAlbumsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const query: Record<string, string> = { isPrimary: validated.isPrimary };
    if (validated.limit !== undefined) query.limit = validated.limit;
    if (validated.offset !== undefined) query.offset = validated.offset;
    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/artist/${validated.artistId}/albums`,
      query,
    });

    if ("error" in result) return errorResponse("Failed to fetch artist albums", result.status);
    return successResponse({ albums: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchAlbumsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
