import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchAlbumsRequest } from "@/lib/research/validateGetResearchAlbumsRequest";

/**
 * GET /api/research/albums
 *
 * Returns the album discography for the given Chartmetric `artist_id`. Thin
 * proxy over Chartmetric's `/artist/:id/albums`. By default `isPrimary=true`
 * is sent upstream so only albums where the artist is a main artist are
 * returned — callers can opt into feature appearances and DJ compilations
 * with `is_primary=false`. Discovery by name is the caller's job via
 * `GET /api/research?type=artists&beta=true`.
 *
 * @param request - must include numeric `artist_id`; optional `is_primary`,
 *   `limit`, `offset`
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
