import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getArtistPublicProfile } from "@/lib/artist/getArtistPublicProfile";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notFound = () =>
  NextResponse.json(
    { status: "error", message: "Artist not found" },
    { status: 404, headers: getCorsHeaders() },
  );

/**
 * Handler for GET /api/artists/{id}/profile — the public artist profile.
 *
 * Deliberately unauthenticated: this backs the shareable artist page, and the
 * profile function it calls returns public fields only. A malformed id, an
 * unknown id and a non-artist account all get the identical 404, so the
 * endpoint cannot be used to probe which account ids exist.
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
    if (!UUID_RE.test(id)) return notFound();

    const profile = await getArtistPublicProfile(id);
    if (!profile) return notFound();

    return NextResponse.json(profile, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[ERROR] getArtistProfileHandler:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
