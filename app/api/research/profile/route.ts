import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchProfileHandler } from "@/lib/research/getResearchProfileHandler";

/**
 * OPTIONS /api/research/profile — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/profile — Full artist profile with bio, genres, social URLs, and label info. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON artist profile or error
 */
export async function GET(request: NextRequest) {
  return getResearchProfileHandler(request);
}
