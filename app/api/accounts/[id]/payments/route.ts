import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPaymentsHandler } from "@/lib/billing/getPaymentsHandler";

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
 * GET /api/accounts/[id]/payments
 *
 * Lists the invoices paid or owed by the account, newest first, with the
 * hosted invoice URL for each receipt. Query: `limit` (1–100, default 20)
 * and `startingAfter` (the last `id` of the previous page). Returns an
 * empty list when the account has no Stripe customer or no invoices.
 *
 * Requires `x-api-key` or `Authorization: Bearer`; the caller must be the
 * account itself or accessible via organization membership.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with `{ account_id, payments, hasMore }`, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getPaymentsHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
