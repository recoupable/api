import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

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
  const artistAccountId = searchParams.get("artist_account_id");

  if (!artistAccountId) {
    return NextResponse.json(
      { error: "artist_account_id parameter is required" },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  return {
    authenticatedAccountId: authResult.accountId,
    artistAccountId,
    accountIds: searchParams.getAll("account_id"),
  };
}
