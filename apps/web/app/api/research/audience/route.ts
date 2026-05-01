import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchAudienceHandler } from "@/lib/research/getResearchAudienceHandler";

/**
 * OPTIONS /api/research/audience — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/audience — Audience demographics by platform. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON audience demographics or error
 */
export async function GET(request: NextRequest) {
  return getResearchAudienceHandler(request);
}
