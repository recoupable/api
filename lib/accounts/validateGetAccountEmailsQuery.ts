import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const getAccountEmailsQuerySchema = z.object({
  artist_account_id: z.preprocess(
    value => value ?? "",
    z
      .string()
      .min(1, "artist_account_id parameter is required")
      .describe("Artist account ID to authorize against."),
  ),
  account_id: z
    .array(z.string())
    .optional()
    .default([])
    .describe("Repeat this query parameter to fetch multiple account email rows."),
});

export interface ValidatedGetAccountEmailsQuery {
  authenticatedAccountId: string;
  artistAccountId: string;
  accountIds: string[];
}

/**
 * Validates auth and query params for GET /api/accounts/emails.
 */
export async function validateGetAccountEmailsQuery(
  request: NextRequest,
): Promise<NextResponse | ValidatedGetAccountEmailsQuery> {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const validationResult = getAccountEmailsQuerySchema.safeParse({
    artist_account_id: searchParams.get("artist_account_id") ?? undefined,
    account_id: searchParams.getAll("account_id"),
  });

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

  return {
    authenticatedAccountId: authResult.accountId,
    artistAccountId: validationResult.data.artist_account_id,
    accountIds: validationResult.data.account_id,
  };
}
