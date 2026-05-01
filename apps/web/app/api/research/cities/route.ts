import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchCitiesHandler } from "@/lib/research/getResearchCitiesHandler";

/**
 * OPTIONS /api/research/cities — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/cities — Geographic listening data for an artist. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON city-level listener data or error
 */
export async function GET(request: NextRequest) {
  return getResearchCitiesHandler(request);
}
