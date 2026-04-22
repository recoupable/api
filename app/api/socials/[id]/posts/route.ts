import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSocialPostsHandler } from "@/lib/posts/getSocialPostsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/socials/{id}/posts
 *
 * Returns paginated posts for the social with the given id.
 *
 * @param request - The request object.
 * @param options - Route options containing the async params.
 * @param options.params - Route params containing the social id.
 * @returns A NextResponse with `{ status, posts, pagination }`.
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  const { id } = await options.params;
  return getSocialPostsHandler(request, id);
}
