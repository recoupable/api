import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifySearchHandler } from "@/lib/spotify/getSpotifySearchHandler";

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
 * GET /api/spotify/search
 *
 * Searches Spotify for tracks, albums, artists, etc.
 *
 * Query parameters:
 * - q (required): Search query string
 * - type (required): Type of search (e.g., "track", "album", "artist")
 * - market (optional): Market code (e.g., "US")
 * - limit (optional): Number of results to return
 * - offset (optional): Offset for pagination
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify search results.
 */
export async function GET(request: NextRequest) {
  return getSpotifySearchHandler(request);
}
