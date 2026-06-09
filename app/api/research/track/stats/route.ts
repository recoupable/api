import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchTrackStatsHandler } from "@/lib/research/getResearchTrackStatsHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/track/stats — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/track/stats — Per-track, per-source current stats (including
 * absolute `streams_total`) by `isrc` / `songstats_track_id` / `spotify_track_id`
 * / `apple_music_track_id`. Requires a track identifier and `?source=`.
 *
 * @param request - must include one track identifier and a `source` query param
 * @returns JSON per-track stats or error
 */
export async function GET(request: NextRequest) {
  return getResearchTrackStatsHandler(request);
}
