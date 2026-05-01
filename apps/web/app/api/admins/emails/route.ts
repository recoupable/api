import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { getAdminEmailsHandler } from "@/lib/admins/emails/getAdminEmailsHandler";

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
 * GET /api/admins/emails?account_id=<id>
 *
 * Returns all Resend emails sent for a given account, including HTML content.
 * Useful for inspecting what pulse emails were sent to an account.
 *
 * Authentication: x-api-key or Authorization Bearer token required.
 * The authenticated account must be a Recoup admin.
 *
 * Query Parameters:
 * - account_id (required): The account ID to fetch emails for
 *
 * Response (200):
 * - status: "success"
 * - emails: Array<{ id, subject, to, from, html, created_at }>
 *
 * Error (400): Missing account_id
 * Error (401): Unauthorized
 * Error (403): Forbidden (not an admin)
 * Error (500): Internal server error
 *
 * @param request - The request object
 * @returns A NextResponse with pulse emails for the account
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return getAdminEmailsHandler(request);
}
