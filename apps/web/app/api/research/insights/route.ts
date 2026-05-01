import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchInsightsHandler } from "@/lib/research/getResearchInsightsHandler";

/**
 * OPTIONS /api/research/insights — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/insights — Noteworthy highlights and trending metrics for an artist. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON insights data or error
 */
export async function GET(request: NextRequest) {
  return getResearchInsightsHandler(request);
}
