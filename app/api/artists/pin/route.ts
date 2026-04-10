import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { pinArtistHandler } from "@/lib/artists/pinArtistHandler";

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
 * POST /api/artists/pin
 *
 * Updates the authenticated account's pinned state for an accessible artist.
 *
 * @param request - The request object containing pin/unpin state
 * @returns A NextResponse with the pin result
 */
export async function POST(request: NextRequest) {
  return pinArtistHandler(request);
}
