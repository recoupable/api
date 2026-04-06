import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/instagram-posts
 *
 * Returns recent Instagram posts for the given artist via Chartmetric's
 * DeepSocial integration.
 * Requires `artist` query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchInstagramPostsHandler(request: NextRequest) {
  return handleArtistResearch(request, cmId => `/SNS/deepSocial/cm_artist/${cmId}/instagram`);
}
