import { type NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { successResponse } from "@/lib/networking/successResponse";
import { getTrackHistoricStatsApifyFirst } from "@/lib/research/playcounts/getTrackHistoricStatsApifyFirst";
import { validateGetResearchTrackHistoricStatsRequest } from "@/lib/research/validateGetResearchTrackHistoricStatsRequest";

/**
 * GET /api/research/track/historic-stats
 *
 * Historic per-track, per-source stats (a daily time-series of cumulative
 * counters incl. `streams_total`) by `isrc` / `songstats_track_id` /
 * `spotify_track_id` / `apple_music_track_id`. Spotify history is served from the measurement store (stitched snapshot + backfill points); other sources via Songstats.
 * sibling of `GET /api/research/track/stats`.
 *
 * @param request - The incoming HTTP request.
 * @returns The JSON response.
 */
export async function getResearchTrackHistoricStatsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const validated = await validateGetResearchTrackHistoricStatsRequest(request);
    if (validated instanceof NextResponse) return validated;

    const result = await getTrackHistoricStatsApifyFirst(validated);
    if ("error" in result) return errorResponse(result.error, result.status);

    const data = result.data;
    const body =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : { data };
    return successResponse(body);
  } catch (error) {
    console.error("[ERROR] getResearchTrackHistoricStatsHandler:", error);
    return errorResponse("Internal error", 500);
  }
}
