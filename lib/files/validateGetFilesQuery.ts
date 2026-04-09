import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { booleanFromString } from "@/lib/content/booleanFromString";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

export const getFilesQuerySchema = z.object({
  artist_account_id: z.string().uuid("artist_account_id must be a valid UUID"),
  path: z.string().optional(),
  recursive: booleanFromString.optional().default(false),
});

export type ValidatedGetFilesQuery = z.infer<typeof getFilesQuerySchema>;

/**
 * Validates GET /api/files query parameters and artist access.
 *
 * @param request - The incoming request.
 * @returns A validation error response or the validated query.
 */
export async function validateGetFilesQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetFilesQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const validationResult = getFilesQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return NextResponse.json(
      {
        status: "error",
        missing_fields: firstError.path,
        error: firstError.message,
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const hasArtistAccess = await checkAccountArtistAccess(
    authResult.accountId,
    validationResult.data.artist_account_id,
  );

  if (!hasArtistAccess) {
    return NextResponse.json(
      {
        status: "error",
        error: "Access denied to specified artist_account_id",
      },
      {
        status: 403,
        headers: getCorsHeaders(),
      },
    );
  }

  return validationResult.data;
}
