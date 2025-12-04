import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyArtistHandler } from "@/lib/spotify/getSpotifyArtistHandler";

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
 * GET /api/spotify/artist
 *
 * Gets a Spotify artist by ID.
 *
 * Query parameters:
 * - id (required): Spotify artist ID
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify artist data.
 */
export async function GET(request: NextRequest) {
  return getSpotifyArtistHandler(request);
}
