import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
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
