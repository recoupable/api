import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteArtistHandler } from "@/lib/artists/deleteArtistHandler";

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
 * DELETE /api/artists/{id}
 *
 * Removes the authenticated account's direct artist link and deletes the artist
 * account if that link was the last remaining owner association.
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the artist account ID
 * @returns A NextResponse with the delete result
 */
export async function DELETE(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return deleteArtistHandler(request, options.params);
}
