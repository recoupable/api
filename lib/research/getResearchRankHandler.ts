import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/rank
 *
 * Returns the artist's global Chartmetric ranking.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchRankHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleArtistResearch({
      ...validated,
      path: cmId => `/artist/${cmId}/artist-rank`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({
      rank: (result.data as Record<string, unknown>)?.artist_rank || null,
    });
  } catch (error) {
    console.error("[ERROR] getResearchRankHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
