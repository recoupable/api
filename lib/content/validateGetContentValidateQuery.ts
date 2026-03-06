import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";

export const getContentValidateQuerySchema = z.object({
  artist_slug: z.string().min(1).optional(),
  artist_account_id: z.string().uuid().optional(),
});

export type ValidatedGetContentValidateQuery = {
  accountId: string;
  artistSlug: string;
};

/**
 * Validates auth and query params for GET /api/content/validate.
 * Accepts either artist_slug or artist_account_id.
 */
export async function validateGetContentValidateQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetContentValidateQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistSlugParam = request.nextUrl.searchParams.get("artist_slug") ?? undefined;
  const artistAccountIdParam = request.nextUrl.searchParams.get("artist_account_id") ?? undefined;

  // Resolve artist slug
  let artistSlug = artistSlugParam;
  if (!artistSlug && artistAccountIdParam) {
    artistSlug = await resolveArtistSlug(artistAccountIdParam) ?? undefined;
    if (!artistSlug) {
      return NextResponse.json(
        { status: "error", error: "Artist not found for the provided artist_account_id" },
        { status: 404, headers: getCorsHeaders() },
      );
    }
  }
  if (!artistSlug) {
    return NextResponse.json(
      { status: "error", error: "Either artist_slug or artist_account_id is required" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    accountId: authResult.accountId,
    artistSlug,
  };
}
