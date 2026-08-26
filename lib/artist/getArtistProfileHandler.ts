import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getArtistPublicProfile } from "@/lib/artist/getArtistPublicProfile";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Handler for GET /api/artists/{id}/profile — the public artist profile.
 *
 * Deliberately unauthenticated: this backs the shareable artist page, and the
 * profile function it calls returns public fields only. A malformed id, an
 * unknown id and a non-artist account all get the identical 404, so the
 * endpoint cannot be used to probe which account ids exist.
 *
 * Dynamic like every other artist route: the response sets no Cache-Control,
 * so a write (socials, name, image, roster, catalog) is visible on the next
 * request instead of after a CDN TTL (recoupable/app#1984).
 *
 * @param request - The incoming request.
 * @param id - The artist account id from the route params.
 * @returns A NextResponse with the profile, 404, or 500.
 */
export async function getArtistProfileHandler(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  try {
    if (!UUID_RE.test(id)) return errorResponse("Artist not found", 404);

    const profile = await getArtistPublicProfile(id);
    if (!profile) return errorResponse("Artist not found", 404);

    return NextResponse.json(profile, { status: 200, headers: getCorsHeaders() });
  } catch (error) {
    console.error("[ERROR] getArtistProfileHandler:", error);
    return errorResponse("Internal server error", 500);
  }
}
