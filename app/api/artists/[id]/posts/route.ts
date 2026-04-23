import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistPostsHandler } from "@/lib/posts/getArtistPostsHandler";

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
 * GET /api/artists/{id}/posts — paginated aggregated posts for an artist
 * account across all connected socials.
 *
 * @param request - Incoming request.
 * @param options - Route context.
 * @param options.params - Path params (artist id).
 * @returns Posts envelope response.
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getArtistPostsHandler(request, id);
}
