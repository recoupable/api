import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { addArtistToOrgHandler } from "@/lib/organizations/addArtistToOrgHandler";

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
 * POST /api/organizations/artists
 *
 * Adds an artist to an organization. This operation is idempotent.
 *
 * Body parameters:
 * - artistId (required): The artist's account ID (UUID)
 * - organizationId (required): The organization's account ID (UUID)
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the created record ID
 */
export async function POST(request: NextRequest) {
  return addArtistToOrgHandler(request);
}
