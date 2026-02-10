import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistsHandler } from "@/lib/artists/getArtistsHandler";
import { createArtistPostHandler } from "@/lib/artists/createArtistPostHandler";

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
 * GET /api/artists
 *
 * Retrieves artists for the authenticated account.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Query parameters:
 * - account_id (optional): Filter to a specific account (UUID). Only for org/admin keys.
 * - organization_id (optional): Filter to artists in a specific organization (UUID).
 *   When omitted, returns only personal (non-organization) artists.
 *
 * @param request - The request object
 * @returns A NextResponse with artists data
 */
export async function GET(request: NextRequest) {
  return getArtistsHandler(request);
}

/**
 * POST /api/artists
 *
 * Creates a new artist account.
 *
 * Request body:
 * - name (required): The name of the artist to create
 * - account_id (optional): The ID of the account to create the artist for (UUID).
 *   Only required for organization API keys creating artists on behalf of other accounts.
 * - organization_id (optional): The organization ID to link the new artist to (UUID)
 *
 * @param request - The request object containing JSON body
 * @returns A NextResponse with the created artist data (201) or error
 */
export async function POST(request: NextRequest) {
  return createArtistPostHandler(request);
}

