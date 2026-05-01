import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getPrivyLoginsHandler } from "@/lib/admins/privy/getPrivyLoginsHandler";

/**
 * GET /api/admins/privy
 *
 * Returns Privy login statistics for the requested time period.
 * Supports daily (last 24h), weekly (last 7 days), and monthly (last 30 days) periods.
 * Requires admin authentication.
 *
 * @param request - The incoming request; `period` is read from the query string
 *   and admin auth from the `x-api-key` / `Authorization: Bearer` header.
 * @returns A 200 NextResponse with the login statistics payload, 400 on invalid
 *   `period`, or 401/403 for non-admin callers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrivyLoginsHandler(request);
}

/**
 * CORS preflight handler for /api/admins/privy.
 *
 * @returns A 204 NextResponse carrying the CORS headers.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
