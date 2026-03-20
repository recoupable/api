import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountHandler } from "@/lib/accounts/getAccountHandler";

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
 * GET /api/accounts/[id]
 *
 * Retrieves account details by ID including profile info, emails, and wallets.
 *
 * Path parameters:
 * - id (required): The unique identifier of the account (UUID)
 *
 * @param request - The request object
 * @param params.params
 * @param params - Route params containing the account ID
 * @returns A NextResponse with account data
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return getAccountHandler(request, params);
}
