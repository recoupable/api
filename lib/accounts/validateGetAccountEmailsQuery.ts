import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

export const getAccountEmailsQuerySchema = z.object({
  account_id: z
    .array(z.string())
    .min(1, "At least one account_id parameter is required")
    .describe("Repeat this query parameter to fetch one or more account email rows."),
});

export interface ValidatedGetAccountEmailsQuery {
  authenticatedAccountId: string;
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
    accountIds: validationResult.data.account_id,
  };
}
