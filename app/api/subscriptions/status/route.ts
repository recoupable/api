import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionStatusHandler } from "@/lib/stripe/getSubscriptionStatusHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 200 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/subscriptions/status?accountId=
 *
 * Returns whether the account has an active paid subscription (direct or via organization).
 * Requires `x-api-key` or `Authorization: Bearer`; the caller must be allowed to access
 * the requested account (same rules as account_id override on other routes).
 *
 * @param request - The incoming HTTP request (query `accountId`, auth headers).
 * @returns JSON `{ isPro }`, or 400/401/403 with `{ error }` per API docs.
 */
export async function GET(request: NextRequest) {
  return getSubscriptionStatusHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
