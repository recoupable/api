import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSpotifyAlbumHandler } from "@/lib/spotify/getSpotifyAlbumHandler";

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
 * GET /api/spotify/album
 *
 * Gets a Spotify album by ID.
 *
 * Query parameters:
 * - id (required): Spotify album ID
 * - market (optional): Market code (e.g., "US")
 *
 * @param request - The request object containing query parameters.
 * @returns A NextResponse with Spotify album data.
 */
export async function GET(request: NextRequest) {
  return getSpotifyAlbumHandler(request);
}
