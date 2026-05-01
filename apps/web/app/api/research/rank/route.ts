import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchRankHandler } from "@/lib/research/getResearchRankHandler";

/**
 * OPTIONS /api/research/rank — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/rank — Artist's global ranking data. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON ranking data or error
 */
export async function GET(request: NextRequest) {
  return getResearchRankHandler(request);
}
