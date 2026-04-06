import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/venues
 *
 * Returns venues the artist has performed at, including capacity and location.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchVenuesHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/venues`,
    undefined,
    data => ({ venues: Array.isArray(data) ? data : [] }),
  );
}
