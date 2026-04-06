import { type NextRequest } from "next/server";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";

/**
 * GET /api/research/audience
 *
 * Returns audience demographic stats for the given artist on a specific platform.
 * Accepts optional `platform` query param (defaults to "instagram").
 * The platform is embedded in the path, not passed as a query param.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchAudienceHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") || "instagram";

  return handleArtistResearch(request, cmId => `/artist/${cmId}/${platform}-audience-stats`);
}
