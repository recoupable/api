import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { validateGetAccountEmailsQuery } from "@/lib/accounts/validateGetAccountEmailsQuery";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Handles GET /api/accounts/emails requests.
 */
export async function getAccountEmailsHandler(request: NextRequest): Promise<NextResponse> {
  const validatedQuery = await validateGetAccountEmailsQuery(request);
  if (validatedQuery instanceof NextResponse) {
    return validatedQuery;
  }

  try {
    const hasAccess = await checkAccountArtistAccess(
      validatedQuery.authenticatedAccountId,
      validatedQuery.artistAccountId,
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized" },
        {
          status: 403,
          headers: getCorsHeaders(),
        },
      );
    }

    if (validatedQuery.accountIds.length === 0) {
      return NextResponse.json([], {
        status: 200,
        headers: getCorsHeaders(),
      });
    }

    const emails = await selectAccountEmails({ accountIds: validatedQuery.accountIds });

    return NextResponse.json(emails, {
      status: 200,
      headers: getCorsHeaders(),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch account emails" },
      {
        status: 500,
        headers: getCorsHeaders(),
      },
    );
  }
}
