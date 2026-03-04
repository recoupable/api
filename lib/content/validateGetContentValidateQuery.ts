import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const getContentValidateQuerySchema = z.object({
  artist_slug: z
    .string({ message: "artist_slug is required" })
    .min(1, "artist_slug cannot be empty"),
});

export type ValidatedGetContentValidateQuery = {
  accountId: string;
  artistSlug: string;
};

/**
 * Validates auth and query params for GET /api/content/validate.
 *
 * @param request
 */
export async function validateGetContentValidateQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetContentValidateQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const artistSlug = request.nextUrl.searchParams.get("artist_slug") ?? "";
  const result = getContentValidateQuerySchema.safeParse({ artist_slug: artistSlug });

  if (!result.success) {
    const firstError = result.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        error: firstError.message,
      },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  return {
    accountId: authResult.accountId,
    artistSlug: result.data.artist_slug,
  };
}
