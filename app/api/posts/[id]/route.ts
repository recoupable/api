import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPostHandler } from "@/lib/publishing/getPostHandler";
import { cancelPostHandler } from "@/lib/publishing/cancelPostHandler";

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

/**
 * DELETE /api/posts/{id}
 *
 * Cancels a post that is still scheduled (contract: Cancel Post).
 *
 * @param request - The incoming request.
 * @param context - Route params carrying the post id.
 * @param context.params - Promise resolving to the route's `id`.
 * @returns 200 `{ id, status }`, 400 on a malformed id, 403 without access, 404
 *   when it does not exist, 409 when it is no longer scheduled, or 500.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return cancelPostHandler(request, id);
}

// Clients poll this while a post publishes; a cached response would freeze it.
export const dynamic = "force-dynamic";
