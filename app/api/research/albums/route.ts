import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchAlbumsHandler } from "@/lib/research/getResearchAlbumsHandler";

/**
 * OPTIONS /api/research/albums — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/albums — Album discography for a Chartmetric artist id.
 * Discovery by name is the caller's job via `GET /api/research`.
 *
 * @param request - must include numeric `artist_id` query param
 * @returns JSON album list or error
 */
export async function GET(request: NextRequest) {
  return getResearchAlbumsHandler(request);
}
