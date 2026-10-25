import { z } from "zod";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/networking/errorResponse";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { resolveArtistSlug } from "@/lib/content/resolveArtistSlug";

const getContentValidateQuerySchema = z.object({
  artist_account_id: z
    .string({ message: "artist_account_id query parameter is required" })
    .min(1, "artist_account_id query parameter is required")
    .uuid("artist_account_id must be a valid UUID"),
});

export type ValidatedGetContentValidateQuery = {
  accountId: string;
  artistAccountId: string;
  artistSlug: string;
};

/**
 * Validates auth and query params for GET /api/content/validate.
 * Requires artist_account_id query parameter.
 */
export async function validateGetContentValidateQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetContentValidateQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const parsed = getContentValidateQuerySchema.safeParse({
    artist_account_id: request.nextUrl.searchParams.get("artist_account_id") ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 400);
  }

  const artistAccountId = parsed.data.artist_account_id;
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
