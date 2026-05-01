import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchMetricsHandler } from "@/lib/research/getResearchMetricsHandler";

/**
 * OPTIONS /api/research/metrics — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/metrics — Platform-specific streaming and social metrics. Requires `?artist=` and `?source=` query params.
 *
 * @param request - must include `artist` and `source` query params
 * @returns JSON metrics data or error
 */
export async function GET(request: NextRequest) {
  return getResearchMetricsHandler(request);
}
