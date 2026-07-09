import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { addArtistToAccountHandler } from "@/lib/accounts/addArtistToAccountHandler";

/**
 * POST /api/accounts/artists
 *
 * Add an artist to the authenticated account's list of associated artists.
 * Requires authentication (x-api-key or Authorization bearer token); the
 * target account is derived from the credential. An optional email override
 * is allowed only when the caller has access to that account.
 * If the artist is already associated with the account, returns success.
 *
 * @param req - The incoming request with artistId (and optional email) in body
 * @returns NextResponse with success status or error
 */
export async function POST(req: NextRequest) {
  return addArtistToAccountHandler(req);
}

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns NextResponse with CORS headers
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
