import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { validateGetResearchPlaylistRequest } from "@/lib/research/validateGetResearchPlaylistRequest";

/**
 * GET /api/research/playlist
 *
 * Returns full Chartmetric playlist details for the supplied `platform` and
 * `id`. This endpoint is a thin proxy over Chartmetric's
 * `/playlist/:platform/:id`; discovery (search by name) is the caller's job
 * via `GET /api/research?type=playlists&beta=true`.
 *
 * @param request - query params: platform, id
 * @returns JSON playlist details or error
 */
export async function getResearchPlaylistHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchPlaylistRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/playlist/${validated.platform}/${validated.id}`,
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
