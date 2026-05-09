import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountSubscriptionHandler } from "@/lib/stripe/getAccountSubscriptionHandler";

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
 * GET /api/accounts/[id]/subscription
 *
 * Returns the subscription resource for an account, including coverage via organization
 * membership. Requires authentication via `x-api-key` or `Authorization: Bearer`; the caller
 * must be the account itself or have access via organization membership.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID from the URL path.
 * @returns A 200 NextResponse with `{ isPro, status, plan, source }`, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getAccountSubscriptionHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
