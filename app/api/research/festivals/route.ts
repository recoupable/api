import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchFestivalsHandler } from "@/lib/research/getResearchFestivalsHandler";

/**
 * OPTIONS /api/research/festivals — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/festivals — List of music festivals.
 *
 * @param request - optional filter query params
 * @returns JSON festival list or error
 */
export async function GET(request: NextRequest) {
  return getResearchFestivalsHandler(request);
}
