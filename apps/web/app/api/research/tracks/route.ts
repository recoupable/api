import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchTracksHandler } from "@/lib/research/getResearchTracksHandler";

/**
 * OPTIONS /api/research/tracks — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/tracks — All tracks for an artist. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON track list or error
 */
export async function GET(request: NextRequest) {
  return getResearchTracksHandler(request);
}
