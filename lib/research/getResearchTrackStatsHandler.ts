import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getTrackStatsApifyFirst } from "@/lib/research/playcounts/getTrackStatsApifyFirst";
import { validateGetResearchTrackStatsRequest } from "@/lib/research/validateGetResearchTrackStatsRequest";
import { endpointModelId } from "@/lib/credits/endpointModelId";

/**
 * GET /api/research/track/stats
 *
 * Current Spotify play count for one recording by `isrc`, served from the
 * measurement store as a single `stats[]` entry.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchTrackStatsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackStatsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await getTrackStatsApifyFirst({
      ...validated,
      modelId: endpointModelId(request, "/api/research/track/stats"),
    });
    if ("error" in result) return errorResponse(result.error, result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackStatsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
