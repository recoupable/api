import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { checkAdminHandler } from "@/lib/admins/checkAdminHandler";

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
 * GET /api/admins
 *
 * Check if the authenticated account is a Recoup admin.
 * Authentication via x-api-key or Authorization: Bearer <token>.
 * Returns { status: "success", isAdmin: boolean }.
 *
 * @param request - The request object
 * @returns A NextResponse with admin status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return checkAdminHandler(request);
}
