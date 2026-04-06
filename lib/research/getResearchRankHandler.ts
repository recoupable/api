import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/rank
 *
 * Returns the artist's global Chartmetric ranking.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchRankHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/artist-rank`,
    undefined,
    data => ({ rank: (data as Record<string, unknown>)?.artist_rank || null }),
  );
}
