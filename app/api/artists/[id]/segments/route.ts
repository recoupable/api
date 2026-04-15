import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSegmentsHandler } from "@/lib/artists/segments/getArtistSegmentsHandler";

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
 * GET /api/artists/{id}/segments
 *
 * Retrieves paginated segments for the artist identified by the path `id`.
 *
 * Query parameters:
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Number of segments per page (default: 20, max: 100)
 *
 * @param request - The incoming request
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with segments and pagination metadata.
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return getArtistSegmentsHandler(request, options.params);
}
