import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { claimSubscriptionHandler } from "@/lib/stripe/claim/claimSubscriptionHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/subscriptions/claim: attaches a subscription bought through
 * `/api/subscriptions/checkout` to the authenticated account when the
 * sign-in email differs from the billing email.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with `{ status, subscription_id, plan }` or an error body.
 */
export async function POST(request: NextRequest) {
  return claimSubscriptionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
