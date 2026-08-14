import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { runValuationHandler } from "@/lib/valuation/runValuationHandler";

// The capture poll can run up to ~90s; give Fluid Compute room beyond that.
export const maxDuration = 120;

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/valuation - Spotify artist id -> account-owned catalog + value band.
 *
 * @param request - The request object containing `{ spotify_artist_id }`.
 * @returns A NextResponse with `{ status, catalog, band, songs_measured }`.
 */
export async function POST(request: NextRequest) {
  return runValuationHandler(request);
}
