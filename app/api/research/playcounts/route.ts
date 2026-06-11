import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchPlaycountsHandler } from "@/lib/research/playcounts/getResearchPlaycountsHandler";

export const maxDuration = 60;

/**
 * OPTIONS /api/research/playcounts — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/playcounts — Latest platform-displayed play counts for
 * every mapped track on an album (`?spotify_album_id=`), served from the
 * measurement store.
 *
 * @param request - must include `spotify_album_id`
 * @returns JSON playcounts or error
 */
export async function GET(request: NextRequest) {
  return getResearchPlaycountsHandler(request);
}
