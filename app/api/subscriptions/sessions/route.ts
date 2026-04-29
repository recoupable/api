import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createSubscriptionSessionHandler } from "@/lib/stripe/createSubscriptionSessionHandler";

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
 * POST /api/subscriptions/sessions: creates a Stripe subscription checkout session.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with session `id` and `url`, or an error body.
 */
export async function POST(request: NextRequest) {
  return createSubscriptionSessionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
