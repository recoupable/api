import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyArtistAlbumsHandler } from "@/lib/spotify/getSpotifyArtistAlbumsHandler";

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
 * GET /api/spotify/artist/albums
 *
 * Gets albums for a Spotify artist by ID.
 *
 * Query parameters:
 * - id (required): Spotify artist ID
 * - include_groups (optional): Comma-separated list of album types to include
 * - market (optional): Market code (e.g., "US")
 * - limit (optional): Number of results to return
 * - offset (optional): Offset for pagination
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify artist albums data.
 */
export async function GET(request: NextRequest) {
  return getSpotifyArtistAlbumsHandler(request);
}
