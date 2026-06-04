import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateGetResearchPlaylistsRequest } from "@/lib/research/validateGetResearchPlaylistsRequest";
import { handleArtistResearch } from "@/lib/research/handleArtistResearch";
import { successResponse } from "@/lib/networking/successResponse";
import { errorResponse } from "@/lib/networking/errorResponse";

/**
 * Playlists handler — returns the playlists an artist currently appears on for
 * a given `?platform=`. Supports `?status=` (current|past) and `?limit=`.
 *
 * @param request - must include `artist` query param
 * @returns JSON playlist placements or error
 */
export async function getResearchPlaylistsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchPlaylistsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { searchParams } = new URL(request.url);

    const query: Record<string, string> = {};
    const limit = searchParams.get("limit");
    if (limit) query.limit = limit;

    const { platform, status, ...rest } = validated;
    const result = await handleArtistResearch({
      ...rest,
      path: cmId => `/artist/${cmId}/${platform}/${status}/playlists`,
      query,
    });

    if ("error" in result) return errorResponse(result.error, result.status);
    return successResponse({ placements: Array.isArray(result.data) ? result.data : [] });
  } catch (error) {
    console.error("[ERROR] getResearchPlaylistsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
