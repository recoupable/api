import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteArtistSocialHandler } from "@/lib/artist/deleteArtistSocialHandler";

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
 * DELETE /api/artists/{id}/socials/{socialId}
 *
 * Removes a social profile link from an artist so a wrongly auto-matched social
 * can be corrected. Unlinks the account_social record; the underlying social is
 * left intact.
 *
 * Authentication: Requires `x-api-key` or `Authorization: Bearer` header.
 *
 * @param request - The request object.
 * @param options - Route options containing params.
 * @param options.params - Route params containing the artist and social IDs.
 * @returns A NextResponse with the delete result.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; socialId: string }> },
) {
  const { id, socialId } = await params;
  return deleteArtistSocialHandler(request, id, socialId);
}
