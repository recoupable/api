import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";

export type ValidatedGetContentValidateQuery = {
  accountId: string;
  artistAccountId: string;
  artistSlug: string;
};

/**
 * Validates auth and query params for GET /api/content/validate.
 * Requires artist_account_id query parameter.
 *
 * @param request - The incoming Next.js request with the artist_account_id query param.
 * @returns A NextResponse with an error if auth or validation fails,
 *   otherwise the validated account ID, artist account ID, and resolved artist slug.
 */
export async function validateGetContentValidateQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetContentValidateQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistAccountId = request.nextUrl.searchParams.get("artist_account_id");
  if (!artistAccountId) {
    return NextResponse.json(
      { status: "error", error: "artist_account_id query parameter is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  const artistSlug = await resolveArtistSlug(artistAccountId);
  if (!artistSlug) {
    return NextResponse.json(
      { status: "error", error: "Artist not found for the provided artist_account_id" },
      { status: 404, headers: getCorsHeaders() },
    );
  }

  return {
    accountId: authResult.accountId,
    artistAccountId: artistAccountId,
    artistSlug,
  };
}
