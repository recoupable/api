import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchPlaylistRequest } from "@/lib/research/validateGetResearchPlaylistRequest";

/**
 * GET /api/research/playlist
 *
 * Looks up a playlist by platform + ID, falling back to a name search when the
 * `id` is non-numeric.
 *
 * @param request - query params: platform, id
 * @returns JSON playlist details or error
 */
export async function getResearchPlaylistHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchPlaylistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const { accountId, platform, id } = validated;
    let playlistId = id;

    if (!/^\d+$/.test(id)) {
      const searchResult = await handleResearch({
        accountId,
        path: "/search",
        query: { q: id, type: "playlists", limit: "1" },
      });

      if ("error" in searchResult) {
        return errorResponse(
          `Search failed with status ${searchResult.status}`,
          searchResult.status,
        );
      }

      const playlists = (
        searchResult.data as { playlists?: { [key: string]: Array<{ id: number }> } }
      )?.playlists?.[platform];

      if (!playlists || playlists.length === 0) {
        return errorResponse(`No playlist found matching "${id}" on ${platform}`, 404);
      }

      playlistId = String(playlists[0].id);
    }

    const result = await handleResearch({
      accountId,
      path: `/playlist/${platform}/${playlistId}`,
    });

    if ("error" in result) return errorResponse("Playlist lookup failed", result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchPlaylistHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
