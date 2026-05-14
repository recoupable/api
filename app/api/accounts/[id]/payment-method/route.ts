import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPaymentMethodHandler } from "@/lib/payment_methods/getPaymentMethodHandler";

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
 * GET /api/accounts/[id]/payment-method
 *
 * Returns the default Stripe payment method on file for the account. `card`
 * is `null` when no payment method has been saved yet — the top-up dialog
 * uses this to decide whether to show a pre-charge confirmation (card
 * present) or route to a checkout session to collect one. Expired cards
 * are returned with their original `exp_month` / `exp_year`; callers should
 * warn before relying on the saved card for an off-session charge.
 *
 * Requires `x-api-key` or `Authorization: Bearer`; the caller must be the
 * account itself or accessible via organization membership.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with `{ account_id, card }`, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getPaymentMethodHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
