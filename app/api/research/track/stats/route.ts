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
 * GET /api/research/track/stats — Current Spotify play count for one recording
 * by `isrc`, from the measurement store.
 *
 * @param request - must include `isrc`; `source` is optional and must be `spotify`
 * @returns JSON per-track stats or error
 */
export async function GET(request: NextRequest) {
  return getResearchTrackStatsHandler(request);
}
