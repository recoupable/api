import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchTrackHistoricStatsHandler } from "@/lib/research/getResearchTrackHistoricStatsHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/track/historic-stats — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/track/historic-stats — Historic per-track, per-source stats
 * (daily time-series incl. cumulative `streams_total`) by `isrc` /
 * `songstats_track_id` / `spotify_track_id` / `apple_music_track_id`. Requires a
 * track identifier and `?source=`.
 *
 * @param request - must include one track identifier and a `source` query param
 * @returns JSON historic per-track stats or error
 */
export async function GET(request: NextRequest) {
  return getResearchTrackHistoricStatsHandler(request);
}
