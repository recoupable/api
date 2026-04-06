import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchInstagramPostsHandler } from "@/lib/research/getResearchInstagramPostsHandler";

/**
 * OPTIONS /api/research/instagram-posts — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/instagram-posts — Recent Instagram posts for an artist. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON Instagram posts or error
 */
export async function GET(request: NextRequest) {
  return getResearchInstagramPostsHandler(request);
}
