import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createPortalSessionHandler } from "@/lib/billing/createPortalSessionHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A 200 NextResponse carrying the CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/accounts/[id]/portal
 *
 * Creates a Stripe Customer Portal session for the account: a hosted page
 * where the customer can update the card on file, view invoices, or cancel
 * a Starter or Pro subscription. Body is `{ returnUrl }`; the response is
 * `{ id, url }` and the client should redirect to `url`.
 *
 * Requires `x-api-key` or `Authorization: Bearer`; the caller must be the
 * account itself or accessible via organization membership.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with `{ id, url }`, or 4xx/5xx with `{ error }`.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return createPortalSessionHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
