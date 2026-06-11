import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPlaycountDeltasHandler } from "@/lib/research/playcounts/getPlaycountDeltasHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/track/playcount-deltas — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/track/playcount-deltas — Change in platform-displayed
 * play counts between the nearest captures (`?isrc=&since=[&until=]`), with
 * an annualized run-rate per platform.
 *
 * @param request - must include `isrc` and `since`
 * @returns JSON deltas or error
 */
export async function GET(request: NextRequest) {
  return getPlaycountDeltasHandler(request);
}
