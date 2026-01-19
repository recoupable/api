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
 * Retrieves artists with optional organization filtering.
 *
 * Query parameters:
 * - accountId (required): The account's ID (UUID)
 * - orgId (optional): Filter to artists in a specific organization (UUID)
 * - personal (optional): Set to "true" to show only personal (non-org) artists
 *
 * Filtering behavior:
 * - accountId only: Returns all artists (personal + all organizations)
 * - accountId + orgId: Returns only artists in that specific organization
 * - accountId + personal=true: Returns only personal artists (not in any org)
 *
 * @param request - The request object containing query parameters
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

