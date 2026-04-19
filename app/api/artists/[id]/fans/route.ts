import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistFansHandler } from "@/lib/fans/getArtistFansHandler";

/**
 * CORS preflight.
 *
 * @returns 200 with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/artists/{id}/fans — paginated fans for an artist account.
 *
 * @param request - Incoming request.
 * @param options - Route context.
 * @param options.params - Path params (artist id).
 * @returns Fans envelope response.
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getArtistFansHandler(request, id);
}
