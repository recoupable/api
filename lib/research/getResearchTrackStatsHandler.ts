import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getResearchTrackStats } from "@/lib/research/getResearchTrackStats";
import { validateGetResearchTrackStatsRequest } from "@/lib/research/validateGetResearchTrackStatsRequest";

/**
 * GET /api/research/track/stats
 *
 * Per-track, per-source current stats (including absolute `streams_total`) by
 * `isrc` / `songstats_track_id` / `spotify_track_id` / `apple_music_track_id`.
 * Thin passthrough to Songstats; mirrors the `stats[].data` envelope of
 * `GET /api/research/metrics`, scoped to a single recording.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchTrackStatsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackStatsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await getResearchTrackStats(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackStatsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
