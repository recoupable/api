import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/insights
 *
 * Returns noteworthy insights and highlights for the given artist
 * (e.g., trending metrics, chart movements, notable playlist adds).
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchInsightsHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/noteworthy-insights`,
    undefined,
    data => ({ insights: Array.isArray(data) ? data : [] }),
  );
}
