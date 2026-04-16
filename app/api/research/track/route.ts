import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchTrackHandler } from "@/lib/research/getResearchTrackHandler";

/**
 * OPTIONS /api/research/track — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/track — Full Chartmetric track details by numeric `id`.
 * Discovery (search by name) is the caller's job via `GET /api/research`.
 *
 * @param request - must include numeric `id` query param
 * @returns JSON track details or error
 */
export async function GET(request: NextRequest) {
  return getResearchTrackHandler(request);
}
