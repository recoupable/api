import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

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

  return {
    authenticatedAccountId: authResult.accountId,
    accountIds: searchParams.getAll("account_id"),
  };
}
