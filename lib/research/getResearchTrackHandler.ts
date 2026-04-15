import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchTrackRequest } from "@/lib/research/validateGetResearchTrackRequest";

/**
 * GET /api/research/track
 *
 * Searches Chartmetric for a track by name, then fetches full details for the
 * top match.
 *
 * @param request - must include `q` query param
 * @returns JSON track details or error
 */
export async function getResearchTrackHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackRequest(request);
    if (validated instanceof NextResponse) return validated;

    const searchResult = await handleResearch({
      accountId: validated.accountId,
      path: "/search",
      query: { q: validated.q, type: "tracks", limit: "1" },
    });

    if ("error" in searchResult) {
      return errorResponse("Track search failed", searchResult.status);
    }

    const tracks = (searchResult.data as { tracks?: Array<{ id: number }> })?.tracks;
    if (!tracks || tracks.length === 0) {
      return errorResponse(`No track found matching "${validated.q}"`, 404);
    }

    const trackId = tracks[0].id;
    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/track/${trackId}`,
    });

    if ("error" in result) return errorResponse("Failed to fetch track details", result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
