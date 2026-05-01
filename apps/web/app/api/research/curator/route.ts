import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchCuratorHandler } from "@/lib/research/getResearchCuratorHandler";

/**
 * OPTIONS /api/research/curator — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/curator — Playlist curator details. Requires `?platform=` and `?id=` query params.
 *
 * @param request - must include `platform` and `id` query params
 * @returns JSON curator profile or error
 */
export async function GET(request: NextRequest) {
  return getResearchCuratorHandler(request);
}
