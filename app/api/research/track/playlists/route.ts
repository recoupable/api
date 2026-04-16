import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getResearchTrackPlaylistsHandler } from "@/lib/research/getResearchTrackPlaylistsHandler";

/**
 * OPTIONS /api/research/track/playlists — CORS preflight.
 *
 * @returns CORS-enabled 200 response
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/research/track/playlists — Playlists featuring a specific track. Requires `?id=` or `?q=` query param.
 *
 * @param request - must include `id` (Chartmetric track ID) or `q` (track name) query param
 * @returns JSON playlist placements for the track or error
 */
export async function GET(request: NextRequest) {
  return getResearchTrackPlaylistsHandler(request);
}
