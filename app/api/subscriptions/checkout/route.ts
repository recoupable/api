import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCheckoutHandler } from "@/lib/stripe/checkout/createCheckoutHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/subscriptions/checkout: Stripe Checkout for a plan, no account
 * required (auth honoured when present). Returns session `id` and `url`.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with `{ id, url }`, or an error body.
 */
export async function POST(request: NextRequest) {
  return createCheckoutHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
