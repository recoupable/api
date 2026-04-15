import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/career
 *
 * Returns career history and milestones for the given artist.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchCareerHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleArtistResearch({
      ...validated,
      path: cmId => `/artist/${cmId}/career`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ career: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchCareerHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
