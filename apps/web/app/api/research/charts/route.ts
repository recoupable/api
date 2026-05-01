import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchChartsHandler } from "@/lib/research/getResearchChartsHandler";

/**
 * OPTIONS /api/research/charts — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/charts — Global chart positions by platform and country. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON chart positions or error
 */
export async function GET(request: NextRequest) {
  return getResearchChartsHandler(request);
}
