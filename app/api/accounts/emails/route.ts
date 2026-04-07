import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountEmailsHandler } from "@/lib/accounts/getAccountEmailsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/accounts/emails
 *
 * Retrieves account email rows for the requested account IDs after verifying
 * that the authenticated caller has access to the provided artist account.
 *
 * Query parameters:
 * - artist_account_id (required): Artist account used for access checks
 * - account_id (optional, repeatable): Account IDs to look up
 */
export async function GET(request: NextRequest) {
  return getAccountEmailsHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
