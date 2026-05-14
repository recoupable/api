import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetResearchMetricsRequest } from "@/lib/research/validateGetResearchMetricsRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * GET /api/research/metrics
 *
 * Returns platform-specific streaming/social metrics for the given artist.
 * Requires `artist` and `source` query params. Source is a platform like
 * "spotify", "youtube", "instagram", etc. and is embedded in the path.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchMetricsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchMetricsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { source, ...rest } = validated;
    const result = await handleArtistResearch({
      ...rest,
      path: cmId => `/artist/${cmId}/stat/${source}`,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchMetricsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
