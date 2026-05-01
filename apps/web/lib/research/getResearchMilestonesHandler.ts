import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/milestones
 *
 * Returns an artist's activity feed — playlist adds, chart entries, and other
 * notable events tracked by Chartmetric.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchMilestonesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleArtistResearch({
      ...validated,
      path: cmId => `/artist/${cmId}/milestones`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({
      milestones: (result.data as Record<string, unknown>)?.insights || [],
    });
  } catch (error) {
    console.error("[ERROR] getResearchMilestonesHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
