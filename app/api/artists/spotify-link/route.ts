import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { linkSpotifyArtistPostHandler } from "@/lib/artists/linkSpotifyArtistPostHandler";

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
 * POST /api/artists/spotify-link
 *
 * Resolve-or-create the artist account for a Spotify artist and link it to the
 * authenticated account's roster. Idempotent.
 *
 * Request body:
 * - spotify_id (required): The Spotify artist ID to resolve-or-create.
 * - name (optional): Display name used only when a new artist account is created.
 * - account_id (optional, UUID): Link on behalf of another account (org keys only).
 * - organization_id (optional, UUID): Link a newly created artist to an organization.
 *
 * @param request - The request object containing JSON body.
 * @returns A NextResponse with `{ success, artist_id, created, linked }` (200) or error.
 */
export async function POST(request: NextRequest) {
  return linkSpotifyArtistPostHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
