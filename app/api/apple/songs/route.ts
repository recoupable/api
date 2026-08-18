import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAppleSongsHandler } from "@/lib/apple/getAppleSongsHandler";

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
 * GET /api/apple/songs
 *
 * Looks up recordings in the Apple Music catalog by ISRC.
 *
 * Query parameters:
 * - isrc (required): One or more ISRCs, comma-separated. Maximum 25.
 * - storefront (optional): Two-letter Apple Music storefront code. Defaults to `us`.
 *
 * Authentication required (`x-api-key` or `Authorization: Bearer`).
 *
 * @param request - The request object containing query parameters.
 * @returns `{ status: "success", storefront, results }` with one entry per requested ISRC.
 */
export async function GET(request: NextRequest) {
  return getAppleSongsHandler(request);
}
