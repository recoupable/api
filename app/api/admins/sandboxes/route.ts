import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAdminSandboxesHandler } from "@/lib/admins/getAdminSandboxesHandler";

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
 * GET /api/admins/sandboxes
 *
 * Returns a table of all accounts with sandbox statistics.
 * Each row includes:
 * - account_id: string
 * - account_name: string | null
 * - total_sandboxes: number — total sandboxes created for this account
 * - last_created_at: string — ISO timestamp of the most recently created sandbox
 *
 * Authentication: x-api-key or Authorization Bearer token required.
 * The authenticated account must be a Recoup admin.
 *
 * Response (200):
 * - status: "success"
 * - accounts: Array<{ account_id, account_name, total_sandboxes, last_created_at }>
 *
 * Error (401): Unauthorized
 * Error (403): Forbidden (not an admin)
 * Error (500): Internal server error
 *
 * @param request - The request object
 * @returns A NextResponse with account sandbox stats
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAdminSandboxesHandler(request);
}
