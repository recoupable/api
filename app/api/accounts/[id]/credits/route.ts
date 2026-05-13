import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountCreditsHandler } from "@/lib/credits/getAccountCreditsHandler";

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
 * GET /api/accounts/[id]/credits
 *
 * Returns the current credit balance for an account, enriched with the plan-derived
 * monthly total, used count, and pro flag. Requires authentication via `x-api-key`
 * or `Authorization: Bearer`; the caller must be the account itself or have access
 * via organization membership. Runs the monthly refill check on read, so the returned
 * `remaining_credits` reflects any due top-up.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID from the URL path.
 * @returns A 200 NextResponse with the credits resource, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getAccountCreditsHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
