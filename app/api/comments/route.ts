import { NextRequest, NextResponse } from "next/server";
import { getCommentsHandler } from "@/lib/comments/getCommentsHandler";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

/**
 * CORS preflight; performs no authentication, lookup or mutation.
 *
 * @returns An empty response with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/comments — authenticated, scoped, read-only stored comments with pagination.
 *
 * @param request - Authenticated request with the target creator and optional stored post UUID.
 * @returns Stored comments or a bounded JSON error, with private caching disabled.
 */
export async function GET(request: NextRequest) {
  const response = await getCommentsHandler(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
