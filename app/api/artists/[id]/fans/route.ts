import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistFansHandler } from "@/lib/fans/getArtistFansHandler";

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
 * GET /api/artists/{id}/fans
 *
 * Returns paginated fans for an artist account, ordered by most recent engagement.
 * Requires authentication via `x-api-key` or `Authorization: Bearer`.
 *
 * Path params:
 * - id (required): The artist account ID (UUID)
 *
 * Query params:
 * - page (optional, default 1, min 1)
 * - limit (optional, default 20, clamped to max 100)
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with the fans envelope
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getArtistFansHandler(request, id);
}
