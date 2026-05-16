import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAdminCreditsRollupHandler } from "@/lib/admins/credits/getAdminCreditsRollupHandler";

/**
 * OPTIONS /api/admins/credits/rollup — CORS preflight.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/admins/credits/rollup — per-account credit usage totals over the
 * selected period (admin-only). See the OpenAPI contract on docs.recoupable.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the paginated rollup rows.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAdminCreditsRollupHandler(request);
}
