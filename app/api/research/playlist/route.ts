import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchPlaylistHandler } from "@/lib/research/getResearchPlaylistHandler";

/**
 * OPTIONS /api/research/playlist — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/playlist — Details for a specific playlist. Requires `?platform=` and `?id=` query params.
 *
 * @param request - must include `platform` and `id` query params
 * @returns JSON playlist details or error
 */
export async function GET(request: NextRequest) {
  return getResearchPlaylistHandler(request);
}
