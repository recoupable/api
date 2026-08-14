import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAutoRechargeHandler } from "@/lib/billing/getAutoRechargeHandler";
import { updateAutoRechargeHandler } from "@/lib/billing/updateAutoRechargeHandler";

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
 * GET /api/accounts/[id]/auto-recharge
 *
 * Returns whether automatic top-up is enabled for the account. `enabled: true`
 * is the default for every account; `enabled: false` means the account has
 * opted out and billed requests that exceed the remaining balance return 402
 * with a `checkoutUrl` instead of silently charging the saved card. The
 * setting lives on the account's Stripe Customer record and is read live.
 *
 * Requires `x-api-key` or `Authorization: Bearer`; the caller must be the
 * account itself or accessible via organization membership.
 *
 * @param request - Incoming request; auth is read from headers.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with `{ account_id, enabled }`, or 4xx with `{ error }`.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getAutoRechargeHandler(request, context.params);
}

/**
 * PATCH /api/accounts/[id]/auto-recharge
 *
 * Enables or disables automatic top-up. Body: `{ enabled: boolean }`.
 * Disabling never removes the saved card — manual checkout top-ups keep
 * working and re-enabling requires no card re-entry.
 *
 * @param request - Incoming request with the JSON body.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID.
 * @returns A 200 NextResponse with `{ account_id, enabled }`, or 4xx with `{ error }`.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return updateAutoRechargeHandler(request, context.params);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
