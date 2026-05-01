import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchSearchHandler } from "@/lib/research/getResearchSearchHandler";

/**
 * OPTIONS /api/research — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research — Search for artists by name. Requires `?q=` query param.
 *
 * @param request - must include `q` query param
 * @returns JSON search results or error
 */
export async function GET(request: NextRequest) {
  return getResearchSearchHandler(request);
}
