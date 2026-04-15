import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/venues
 *
 * Returns venues the artist has performed at, including capacity and location.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchVenuesHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleArtistResearch({
      artist: validated.artist,
      accountId: validated.accountId,
      path: cmId => `/artist/${cmId}/venues`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ venues: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchVenuesHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
