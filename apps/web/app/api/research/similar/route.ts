import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchSimilarHandler } from "@/lib/research/getResearchSimilarHandler";

/**
 * OPTIONS /api/research/similar — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/similar — Similar artists by audience, genre, mood, or musicality. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON array of similar artists or error
 */
export async function GET(request: NextRequest) {
  return getResearchSimilarHandler(request);
}
