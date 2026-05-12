import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { stripeWebhookHandler } from "@/lib/stripe/stripeWebhookHandler";

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
 * POST /api/webhooks/stripe: receives Stripe webhook events.
 *
 * Currently handles `checkout.session.completed` for credits top-up sessions —
 * credits are added to the account's balance based on session metadata.
 * Stripe retries on 5xx responses; idempotency-via-event-id is a planned
 * follow-up (small double-credit risk window today on retry after partial
 * failure).
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse acknowledging receipt, or an error body.
 */
export async function POST(request: NextRequest) {
  return stripeWebhookHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
