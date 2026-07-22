import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { deleteAccountSocial } from "@/lib/supabase/account_socials/deleteAccountSocial";
import { validateDeleteArtistSocialRequest } from "@/lib/artist/validateDeleteArtistSocialRequest";

/**
 * Handler for DELETE /api/artists/{id}/socials/{socialId}.
 *
 * Unlinks a social profile from an artist so a wrongly auto-matched social can
 * be removed. Validates path params, auth, and artist access, then deletes the
 * account_social link. The underlying social record is left intact.
 *
 * @param request - The incoming request
 * @param id - The artist account ID from the route params
 * @param socialId - The social ID from the route params
 * @returns A NextResponse with the delete result or an error
 */
export async function deleteArtistSocialHandler(
  request: NextRequest,
  id: string,
  socialId: string,
): Promise<NextResponse> {
  try {
    const validated = await validateDeleteArtistSocialRequest(request, id, socialId);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const deleted = await deleteAccountSocial(validated.artistId, validated.socialId);
    if (!deleted) {
      return NextResponse.json(
        {
          status: "error",
          error: "Failed to unlink social from artist",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        socialId: validated.socialId,
      },
      {
        status: 200,
        headers: getCorsHeaders(),
      },
    );
  } catch (error) {
    console.error("[ERROR] deleteArtistSocialHandler:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Internal server error",
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
