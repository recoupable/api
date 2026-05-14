import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAccountsWithSandboxesHandler } from "@/lib/admins/getAccountsWithSandboxesHandler";

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
 * GET /api/admins/accounts-with-sandboxes
 *
 * Lists all accounts that have created sandboxes, with summary stats.
 * Admin-only endpoint — requires Recoup org membership.
 *
 * Authentication: x-api-key header or Authorization Bearer token required.
 *
 * Response (200):
 * - status: "success"
 * - accounts: [{ account_id, account_name, total_sandboxes, last_created_at }]
 *
 * Error (401/403):
 * - status: "error"
 * - error: string
 *
 * @param request - The request object
 * @returns A NextResponse with account sandbox summaries
 */
export async function GET(request: NextRequest): Promise<Response> {
  return getAccountsWithSandboxesHandler(request);
}
