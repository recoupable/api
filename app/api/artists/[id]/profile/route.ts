import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistProfileHandler } from "@/lib/artist/getArtistProfileHandler";

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
 * GET /api/artists/{id}/profile
 *
 * Public artist profile: name, image, connected socials and linked catalogs.
 * No authentication — this backs the shareable artist page at
 * chat.recoupable.dev/artists/{id}. Public fields only; see the OpenAPI
 * contract on docs.recoupable.
 *
 * @param request - The request object.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the artist account UUID.
 * @returns A NextResponse with the profile, 404, or 500.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getArtistProfileHandler(request, id);
}

export const dynamic = "force-dynamic";
