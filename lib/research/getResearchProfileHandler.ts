import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/profile
 *
 * Returns the full Chartmetric artist profile for the given artist.
 * Requires `artist` query param (name, numeric ID, or UUID).
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchProfileHandler(request: NextRequest) {
  return handleArtistResearch(request, cmId => `/artist/${cmId}`);
}
