import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountUsageHandler } from "@/lib/usage/getAccountUsageHandler";

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
 * GET /api/accounts/[id]/usage
 *
 * Returns the account's credit charge line items (one per `usage_events` row),
 * newest first with keyset pagination, plus the total for the period. Requires
 * authentication via `x-api-key` or `Authorization: Bearer`; the caller must be
 * the account itself or have access via organization membership.
 *
 * @param request - Incoming request; auth from headers, filters from the query string.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID from the URL path.
 * @returns A 200 NextResponse with the usage resource, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getAccountUsageHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
