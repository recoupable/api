import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountHandler } from "@/lib/accounts/getAccountHandler";

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
 * GET /api/accounts/[id]
 *
 * Retrieves account details by ID including profile info, emails, and wallets.
 * Requires authentication via `x-api-key` or `Authorization: Bearer`; the caller must be
 * allowed to access the requested account (same account, org delegation, or Recoup admin).
 *
 * @param request - The incoming request. Authentication is read from the
 *   `x-api-key` or `Authorization: Bearer` header by `getAccountHandler`.
 * @param context - Route context from Next.js.
 * @param context.params - Promise resolving to `{ id }`, the account UUID from the URL path.
 * @returns A 200 NextResponse with the account payload, 401/403 if the caller lacks access,
 *   or 404 when the account does not exist.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return getAccountHandler(request, context.params);
}
