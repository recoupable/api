import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAutoTopUpHandler } from "@/lib/billing/getAutoTopUpHandler";
import { updateAutoTopUpHandler } from "@/lib/billing/updateAutoTopUpHandler";

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
 * GET /api/accounts/[id]/auto-top-up
 *
 * Opt-in auto top-up settings for the account: `enabled`, `amountCents`,
 * `thresholdCents`, plus `lastRunAt` / `lastError` from the last attempt.
 * Defaults (off, nulls) when never configured. `{id}` may be the caller's
 * account or an organization they belong to.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with the settings, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getAutoTopUpHandler(request, context.params);
}

/**
 * PUT /api/accounts/[id]/auto-top-up
 *
 * Replaces all three settings. `enabled: true` needs a card on file
 * (400 otherwise), `amountCents` 500..100000, `thresholdCents` below it.
 *
 * @param request - Incoming request; auth from headers, settings in the JSON body.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with the saved settings, or 4xx with `{ error }`.
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateAutoTopUpHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
