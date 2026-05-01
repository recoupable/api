import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchPlaylistsHandler } from "@/lib/research/getResearchPlaylistsHandler";

/**
 * OPTIONS /api/research/playlists — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/playlists — Playlists featuring an artist on a given platform. Requires `?artist=` query param.
 *
 * @param request - must include `artist` query param
 * @returns JSON playlist placements or error
 */
export async function GET(request: NextRequest) {
  return getResearchPlaylistsHandler(request);
}
