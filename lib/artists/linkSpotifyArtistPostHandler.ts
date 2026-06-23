import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { safeParseJson } from "@/lib/networking/safeParseJson";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateLinkSpotifyArtistBody } from "@/lib/artists/validateLinkSpotifyArtistBody";
import { linkSpotifyArtistToAccount } from "@/lib/artists/linkSpotifyArtistToAccount";

/**
 * Handler for POST /api/artists/spotify-link.
 *
 * Resolve-or-create the artist account for a Spotify artist and link it to the
 * authenticated account's roster (via account_artist_ids). Idempotent. The
 * account is derived from the credentials (x-api-key or Bearer); an optional
 * account_id override is honored only for org keys with access.
 *
 * @param request - The request with `{ spotify_id, name?, account_id?, organization_id? }`.
 * @returns 200 `{ success, artist_id, created, linked }` or an error response.
 */
export async function linkSpotifyArtistPostHandler(request: NextRequest): Promise<NextResponse> {
  const body = await safeParseJson(request);

  const validated = validateLinkSpotifyArtistBody(body);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const authContext = await validateAuthContext(request, {
    accountId: validated.account_id,
    organizationId: validated.organization_id,
  });
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  try {
    const result = await linkSpotifyArtistToAccount({
      spotifyId: validated.spotify_id,
      accountId: authContext.accountId,
      name: validated.name,
      organizationId: validated.organization_id,
    });

    return NextResponse.json(
      {
        success: true,
        artist_id: result.artistId,
        created: result.created,
        linked: result.linked,
      },
      { status: 200, headers: getCorsHeaders() },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to link artist";
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
