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
 * POST /api/subscriptions/sessions
 *
 * Creates a Stripe Checkout session for subscription billing.
 *
 * @param request - Incoming request (JSON body: successUrl, optional cancelUrl)
 * @returns Delegates to createSubscriptionSessionHandler (checkout URL or error)
 */
export async function POST(request: NextRequest) {
  return createSubscriptionSessionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
