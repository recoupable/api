import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/milestones
 *
 * Returns an artist's activity feed — playlist adds, chart entries, and other
 * notable events tracked by Chartmetric.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchMilestonesHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/milestones`,
    undefined,
    data => ({ milestones: (data as Record<string, unknown>)?.insights || [] }),
  );
}
