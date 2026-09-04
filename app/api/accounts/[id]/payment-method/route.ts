import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPaymentMethodHandler } from "@/lib/billing/getPaymentMethodHandler";
import { createPaymentMethodSessionHandler } from "@/lib/billing/createPaymentMethodSessionHandler";
import { deletePaymentMethodHandler } from "@/lib/billing/deletePaymentMethodHandler";

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

/**
 * POST /api/accounts/[id]/payment-method
 *
 * Mints a $0 Stripe `setup` Checkout session that saves a card for the
 * account; the saved card becomes the customer's default via the
 * `checkout.session.completed` webhook. Body: `{ successUrl }`.
 *
 * @param request - Incoming request; auth from headers, body `{ successUrl }`.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with `{ id, url }`, or 4xx/5xx with `{ error }`.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return createPaymentMethodSessionHandler(request, context.params);
}

/**
 * DELETE /api/accounts/[id]/payment-method
 *
 * Detaches the account's default card. Invoiced subscriptions are unaffected.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 204 NextResponse, or 404 `{ error }` when no card is on file.
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return deletePaymentMethodHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
