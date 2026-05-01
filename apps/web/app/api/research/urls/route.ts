import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchUrlsHandler } from "@/lib/research/getResearchUrlsHandler";

/**
 * OPTIONS /api/research/urls — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/urls — All known platform URLs for an artist. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON platform URLs or error
 */
export async function GET(request: NextRequest) {
  return getResearchUrlsHandler(request);
}
