import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getTrackHistoricStatsApifyFirst } from "@/lib/research/playcounts/getTrackHistoricStatsApifyFirst";
import { validateGetResearchTrackHistoricStatsRequest } from "@/lib/research/validateGetResearchTrackHistoricStatsRequest";
import { endpointModelId } from "@/lib/credits/endpointModelId";

/**
 * GET /api/research/track/historic-stats
 *
 * Historic Spotify series for one recording by `isrc` (one cumulative
 * `streams_total` point per capture date) from the measurement store;
 * sibling of `GET /api/research/track/stats`.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchTrackHistoricStatsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackHistoricStatsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await getTrackHistoricStatsApifyFirst({
      ...validated,
      modelId: endpointModelId(request, "/api/research/track/historic-stats"),
    });
    if ("error" in result) return errorResponse(result.error, result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackHistoricStatsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
