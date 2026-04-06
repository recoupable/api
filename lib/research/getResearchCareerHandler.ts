import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/career
 *
 * Returns career history and milestones for the given artist.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchCareerHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/career`,
    undefined,
    data => ({ career: Array.isArray(data) ? data : [] }),
  );
}
