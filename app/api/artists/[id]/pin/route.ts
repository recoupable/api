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
 * POST /api/artists/{id}/pin
 *
 * Pins the artist for the authenticated account.
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with the pin result
 */
export async function POST(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return pinArtistHandler(request, options.params, true);
}

/**
 * DELETE /api/artists/{id}/pin
 *
 * Unpins the artist for the authenticated account.
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with the unpin result
 */
export async function DELETE(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return pinArtistHandler(request, options.params, false);
}
