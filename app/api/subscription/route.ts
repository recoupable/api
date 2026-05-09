import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionHandler } from "@/lib/subscription/getSubscriptionHandler";

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
 * Returns the authenticated account's active Stripe subscription
 * (account preferred over org) along with a derived `isPro` flag and a
 * `source` marker indicating where the subscription is anchored. Auth:
 * API key or Privy Bearer token.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with `{ isPro, source, subscription }` on 200
 *   or `{ message }` on 4xx/5xx.
 */
export async function GET(request: NextRequest) {
  return getSubscriptionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
