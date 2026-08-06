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
 * Requires authentication via x-api-key header or Authorization bearer token.
 * The caller must be a member of the organization or a Recoup admin.
 *
 * Body parameters:
 * - artistId (required): The artist's account ID (UUID)
 * - organizationId (required): The organization's account ID (UUID)
 *
 * Response:
 * - 200: { status: "success", id: string }
 * - 400: Invalid parameters
 * - 401: Missing or invalid credentials
 * - 403: Caller is not a member of the organization
 *
 * @param request - The request object containing the body
 * @returns A NextResponse with the created record ID
 */
export async function POST(request: NextRequest) {
  return addArtistToOrgHandler(request);
}
