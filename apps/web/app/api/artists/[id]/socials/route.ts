import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistSocialsHandler } from "@/lib/artist/getArtistSocialsHandler";

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
 * GET /api/artists/{id}/socials
 *
 * Retrieves all social media profiles associated with an artist account.
 *
 * Path parameters:
 * - id (required): The unique identifier of the artist account (UUID).
 *
 * Query parameters:
 * - page (optional): Page number for pagination (default: 1).
 * - limit (optional): Number of socials per page (default: 20, max: 100).
 *
 * Authentication: Requires `x-api-key` or `Authorization: Bearer` header.
 *
 * @param request - The request object.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the artist account ID.
 * @returns A NextResponse with social media profiles and pagination metadata.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getArtistSocialsHandler(request, id);
}
