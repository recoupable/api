import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistsProHandler } from "@/lib/artists/getArtistsProHandler";

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
 * GET /api/artists/pro
 *
 * Returns a deduplicated list of artist IDs owned by "pro" accounts
 * (enterprise-domain emails or active Stripe subscriptions). Admin-scoped —
 * the response is the paying-customer list.
 *
 * @param request - The incoming request.
 * @returns A NextResponse with `{ status, artists, [error] }`.
 */
export async function GET(request: NextRequest) {
  return getArtistsProHandler(request);
}
