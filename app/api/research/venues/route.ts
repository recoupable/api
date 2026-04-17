import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchVenuesHandler } from "@/lib/research/getResearchVenuesHandler";

/**
 * OPTIONS /api/research/venues — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/venues — Venues an artist has performed at. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON venue list or error
 */
export async function GET(request: NextRequest) {
  return getResearchVenuesHandler(request);
}
