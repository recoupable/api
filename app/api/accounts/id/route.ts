import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountIdHandler } from "@/lib/accounts/getAccountIdHandler";

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
 * GET /api/accounts/id
 *
 * Retrieve the ID of the authenticated account associated with the provided credentials.
 * Authentication can be provided via either:
 * - x-api-key header
 * - Authorization: Bearer <token> header
 *
 * Exactly one of these headers must be provided.
 *
 * @param request - The request object
 * @returns A NextResponse with the accountId or an error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAccountIdHandler(request);
}
