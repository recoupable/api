import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPostHandler } from "@/lib/publishing/getPostHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

/**
 * GET /api/posts/{id}
 *
 * One post, polled while it publishes (contract: recoupable/docs#375).
 *
 * @param request - The incoming request.
 * @param context - Route params carrying the post id.
 * @param context.params - Promise resolving to the route's `id`.
 * @returns 200 with the post, 400 on a malformed id, 403 without access, 404
 *   when it does not exist, or 500.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return getPostHandler(request, id);
}

// Clients poll this while a post publishes; a cached response would freeze it.
export const dynamic = "force-dynamic";
