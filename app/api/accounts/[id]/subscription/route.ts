import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionsHandler } from "@/lib/subscriptions/getSubscriptionsHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * GET /api/accounts/{id}/subscription
 *
 * Returns the account's active Stripe subscription, or a short-circuit
 * `{ isEnterprise: true }` for enterprise-domain accounts.
 *
 * @param request - The request object
 * @param options - Route options containing params
 * @param options.params - Route params containing the account ID
 * @returns A NextResponse with `{ status, subscription }` or `{ status, isEnterprise }`
 */
export async function GET(request: NextRequest, options: { params: Promise<{ id: string }> }) {
  return getSubscriptionsHandler(request, options.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
