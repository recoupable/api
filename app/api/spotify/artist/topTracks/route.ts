import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyArtistTopTracksHandler } from "@/lib/spotify/getSpotifyArtistTopTracksHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/spotify/artist/topTracks
 *
 * Gets top tracks for a Spotify artist by ID.
 *
 * Query parameters:
 * - id (required): Spotify artist ID
 * - market (optional): Market code (e.g., "US")
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify artist top tracks data.
 */
export async function GET(request: NextRequest) {
  return getSpotifyArtistTopTracksHandler(request);
}
