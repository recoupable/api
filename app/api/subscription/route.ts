import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionStatusHandler } from "@/lib/subscription/getSubscriptionStatusHandler";

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
 * GET /api/subscription
 *
 * Returns whether the authenticated account is on a pro Stripe
 * subscription (account or any of its organizations). Auth: API key or
 * Privy Bearer token.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with `{ isPro }` on 200 or `{ message }` on 4xx/5xx.
 */
export async function GET(request: NextRequest) {
  return getSubscriptionStatusHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
