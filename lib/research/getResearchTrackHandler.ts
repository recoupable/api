import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { handleResearch } from "@/lib/research/handleResearch";
import { pickBestTrackMatch, type SearchTrack } from "@/lib/research/pickBestTrackMatch";
import { validateGetResearchTrackRequest } from "@/lib/research/validateGetResearchTrackRequest";

/**
 * GET /api/research/track
 *
 * Searches Chartmetric for a track by name, picks the best match (optionally
 * disambiguated by `artist`), then fetches full details for that track.
 *
 * @param request - must include `q` query param; optional `artist` param
 *   disambiguates against candidate tracks' `artist_names`.
 * @returns JSON track details or error
 */
export async function getResearchTrackHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackRequest(request);
    if (validated instanceof NextResponse) return validated;

    const searchResult = await handleResearch({
      accountId: validated.accountId,
      path: "/search",
      query: { q: validated.q, type: "tracks", limit: "25" },
    });

    if ("error" in searchResult) {
      return errorResponse("Track search failed", searchResult.status);
    }

    const tracks = (searchResult.data as { tracks?: SearchTrack[] })?.tracks ?? [];
    const match = pickBestTrackMatch({
      tracks,
      q: validated.q,
      artist: validated.artist,
    });

    if (!match) {
      const suffix = validated.artist ? ` by "${validated.artist}"` : "";
      return errorResponse(`No track found matching "${validated.q}"${suffix}`, 404);
    }

    const result = await handleResearch({
      accountId: validated.accountId,
      path: `/track/${match.id}`,
    });

    if ("error" in result) return errorResponse("Failed to fetch track details", result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
