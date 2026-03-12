import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

interface GetAccountEmailsParams {
  accountIds: string[];
  currentAccountId: string;
  artistAccountId: string;
}

/**
 * Handler for GET /api/account-emails
 *
 * Fetches account emails for the given account IDs, after verifying that the
 * requesting account has access to the specified artist.
 */
export async function getAccountEmailsHandler({
  accountIds,
  currentAccountId,
  artistAccountId,
}: GetAccountEmailsParams): Promise<NextResponse> {
  if (!currentAccountId || !artistAccountId) {
    return NextResponse.json(
      { error: "Missing authentication parameters" },
      { status: 400, headers: getCorsHeaders() },
    );
  }

  if (!accountIds || accountIds.length === 0) {
    return NextResponse.json([], { status: 200, headers: getCorsHeaders() });
  }

  try {
    const hasAccess = await checkAccountArtistAccess(currentAccountId, artistAccountId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    const emails = await selectAccountEmails({ accountIds });
    return NextResponse.json(emails, { status: 200, headers: getCorsHeaders() });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch account emails" },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
