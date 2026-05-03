import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getSubscriptionStatusHandler } from "@/lib/stripe/getSubscriptionStatusHandler";

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
 * GET /api/subscriptions/status: returns whether the account has active paid access (direct or via organization).
 *
 * @param request - The incoming HTTP request (query `accountId` required).
 * @returns JSON `{ isPro }` or an `{ error }` body with 4xx status.
 */
export async function GET(request: NextRequest) {
  return getSubscriptionStatusHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
