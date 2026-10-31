import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPostStatsHandler } from "@/lib/publishing/stats/getPostStatsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/posts/{id}/stats
 *
 * A published post's platform analytics, read live (contract: Get Post Stats).
 *
 * @param request - The incoming request.
 * @param context - Route params carrying the post id.
 * @param context.params - Promise resolving to the route's `id`.
 * @returns 200 with the stats, 400 on a malformed id, 403 without access, 404
 *   when it does not exist, 409 when it is not published or LinkedIn is not
 *   connected, 422 when its platform or post type has no stats, 502 when the
 *   platform rejects the read, or 500.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return getPostStatsHandler(request, id);
}

// Stats are read live; a cached response would freeze them.
export const dynamic = "force-dynamic";
