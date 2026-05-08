import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSubscriptionPortalHandler } from "@/lib/stripe/createSubscriptionPortalHandler";

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
 * POST /api/subscriptions/portal: creates a subscription management (billing portal) session.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with portal session `id` and `url`, or an error body.
 */
export async function POST(request: NextRequest) {
  return createSubscriptionPortalHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
