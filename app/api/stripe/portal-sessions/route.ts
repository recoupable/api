import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createPortalSessionHandler } from "@/lib/stripe/portal/createPortalSessionHandler";

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
 * POST /api/stripe/portal-sessions: creates a Stripe billing portal
 * session for the authenticated account's existing Stripe customer.
 *
 * @param request - The incoming HTTP request.
 * @returns A NextResponse with session `id` and `url`, or an error body.
 */
export async function POST(request: NextRequest) {
  return createPortalSessionHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
