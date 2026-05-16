import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAdminCreditsEventsHandler } from "@/lib/admins/credits/getAdminCreditsEventsHandler";

/**
 * OPTIONS /api/admins/credits/events — CORS preflight.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * GET /api/admins/credits/events — raw usage_events rows for one account over
 * the selected period (admin-only). See the OpenAPI contract on docs.recoupable.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the paginated usage_events rows.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAdminCreditsEventsHandler(request);
}
