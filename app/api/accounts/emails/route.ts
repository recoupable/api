import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountEmailsHandler } from "@/lib/accounts/getAccountEmailsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
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
 *
 * @param request - The incoming request with artist and account query parameters.
 * @returns A NextResponse with matching account email rows or an error response.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAccountEmailsHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
