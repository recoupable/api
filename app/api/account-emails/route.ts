import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountEmailsHandler } from "@/lib/account-emails/getAccountEmailsHandler";

/**
 * GET /api/account-emails
 *
 * Fetches account emails for given account IDs, verifying the requester
 * has access to the specified artist.
 *
 * Query params:
 *  - accountIds (repeated) — account IDs to fetch emails for
 *  - currentAccountId — the requesting account
 *  - artistAccountId — the artist context for access control
 */
export async function GET(req: NextRequest) {
  const accountIds = req.nextUrl.searchParams.getAll("accountIds");
  const currentAccountId = req.nextUrl.searchParams.get("currentAccountId") ?? "";
  const artistAccountId = req.nextUrl.searchParams.get("artistAccountId") ?? "";

  return getAccountEmailsHandler({ accountIds, currentAccountId, artistAccountId });
}

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
