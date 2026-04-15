import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { resolveTrack } from "@/lib/research/resolveTrack";
import { validateGetResearchTrackPlaylistsRequest } from "@/lib/research/validateGetResearchTrackPlaylistsRequest";

/**
 * GET /api/research/track/playlists
 *
 * Returns playlists featuring a specific track. Accepts a Chartmetric track ID
 * directly, or resolves via track name + optional artist.
 *
 * @param request - query params: id or q (+artist), platform, status, filter flags, pagination
 * @returns JSON playlist placements for the track or error
 */
export async function getResearchTrackPlaylistsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackPlaylistsRequest(request);
    if (validated instanceof NextResponse) return validated;

    let trackId = validated.id;
    if (!trackId) {
      const resolved = await resolveTrack(validated.q!, validated.artist);
      if (resolved.error) return errorResponse(resolved.error, 404);
      trackId = resolved.id;
    }

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/track/${trackId}/${validated.platform}/${validated.status}/playlists`,
      query: { ...validated.pagination, ...validated.filters },
    });

    if ("error" in result) return errorResponse(result.error, result.status);

    return successResponse({
      placements: Array.isArray(result.data) ? result.data : [],
    });
  } catch (error) {
    console.error("[ERROR] getResearchTrackPlaylistsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
