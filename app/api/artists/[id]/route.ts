import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistHandler } from "@/lib/artists/getArtistHandler";

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
 * GET /api/artists/[id]
 *
 * Retrieves a single artist detail payload for an accessible artist account.
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with artist data
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return getArtistHandler(request, options.params);
}
