import { NextRequest, NextResponse } from "next/server";
import getAccountEmails from "@/lib/supabase/account_emails/getAccountEmails";
import { checkAccountArtistAccess } from "@/lib/supabase/account_artist_ids/checkAccountArtistAccess";

/**
 * GET /api/account-emails?accountIds=<id>&currentAccountId=<id>&artistAccountId=<id>
 *
 * Fetches email addresses for the given account IDs.
 * Requires the current user to have access to the specified artist.
 */
export async function GET(req: NextRequest) {
  const accountIds = req.nextUrl.searchParams.getAll("accountIds");
  const currentAccountId = req.nextUrl.searchParams.get("currentAccountId");
  const artistAccountId = req.nextUrl.searchParams.get("artistAccountId");

  if (!currentAccountId || !artistAccountId) {
    return NextResponse.json(
      { error: "Missing authentication parameters" },
      { status: 400 },
    );
  }

  if (!accountIds || accountIds.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const hasAccess = await checkAccountArtistAccess(
      currentAccountId,
      artistAccountId,
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const emails = await getAccountEmails(accountIds);
    return NextResponse.json(emails);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch account emails" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
