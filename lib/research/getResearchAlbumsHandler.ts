import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/albums
 *
 * Returns the album discography for the given artist.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchAlbumsHandler(request: NextRequest) {
  return handleArtistResearch(
    request,
    cmId => `/artist/${cmId}/albums`,
    undefined,
    data => ({ albums: Array.isArray(data) ? data : [] }),
  );
}
