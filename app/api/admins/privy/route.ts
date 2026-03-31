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
 * @param request - The incoming request with optional period query param
 * @returns A NextResponse with Privy login statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getPrivyLoginsHandler(request);
}

/**
 * CORS preflight handler.
 *
 * @returns A NextResponse with CORS headers allowing cross-origin access
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
}
