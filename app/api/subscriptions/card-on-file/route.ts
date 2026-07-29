import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createCardOnFileSessionHandler } from "@/lib/stripe/createCardOnFileSessionHandler";

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
 * POST /api/subscriptions/card-on-file: creates a $0 Stripe `setup` checkout
 * session that saves a card on file for the authenticated account. No charge is
 * made and no subscription starts; the saved card is what lets a later credit
 * shortfall auto-recharge instead of dead-ending.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with session `id` and `url`, or an error body.
 */
export async function POST(request: NextRequest) {
  return createCardOnFileSessionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
