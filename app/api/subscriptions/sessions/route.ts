import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createStripeSessionHandler } from "@/lib/stripe/createStripeSessionHandler";

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
 * Creates a Stripe checkout session for the authenticated account.
 * Returns a hosted checkout URL the client should redirect to.
 *
 * Request body:
 * - successUrl (required): URL to redirect to after a successful payment.
 * - accountId (optional): account override (UUID) when the authenticated key/token
 *   has access to multiple accounts.
 *
 * Response:
 * - 200: { id: string, url: string }
 * - 400: { status: "error", error: "validation error message" }
 * - 401: { status: "error", error: "authentication error" }
 * - 403: { status: "error", error: "access denied" }
 * - 500: { status: "error", error: "Failed to create Stripe session" }
 *
 * @param request - The request object containing JSON body.
 * @returns A NextResponse with the checkout session data or an error.
 */
export async function POST(request: NextRequest) {
  return createStripeSessionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
