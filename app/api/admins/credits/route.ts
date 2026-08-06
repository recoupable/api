import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { postAdminCreditsHandler } from "@/lib/admins/credits/postAdminCreditsHandler";

/**
 * OPTIONS /api/admins/credits — CORS preflight.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: getCorsHeaders() });
}

/**
 * POST /api/admins/credits — sets an account's credit balance to an absolute
 * value and records the acting admin and the reason (admin-only). See the
 * OpenAPI contract on docs.recoupable.
 *
 * @param request - The incoming Next.js request.
 * @returns A NextResponse with the recorded grant.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return postAdminCreditsHandler(request);
}
