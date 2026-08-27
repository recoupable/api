import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateArtistRequest } from "@/lib/research/validateArtistRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";
import { endpointModelId } from "@/lib/credits/endpointModelId";

/**
 * GET /api/research/tracks
 *
 * Returns all tracks for the given artist.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchTracksHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateArtistRequest(request);
    if (validated instanceof NextResponse) return validated;
    const result = await handleArtistResearch({
      modelId: endpointModelId(request, "/api/research/tracks"),
      ...validated,
      path: cmId => `/artist/${cmId}/tracks`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ tracks: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchTracksHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
