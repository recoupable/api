import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { createNotificationHandler } from "@/lib/notifications/createNotificationHandler";

/**
 * OPTIONS handler for CORS preflight requests.
 *
 * @returns A NextResponse with CORS headers.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

/**
 * POST /api/notifications
 *
 * Sends a notification email to the authenticated account's email address via Resend.
 * The recipient is automatically resolved from the API key or Bearer token.
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * Body parameters:
 * - subject (required): email subject line
 * - text (optional): plain text / Markdown body
 * - html (optional): raw HTML body (takes precedence over text)
 * - cc (optional): array of CC email addresses
 * - headers (optional): custom email headers
 * - room_id (optional): room ID for chat link in footer
 * - account_id (optional): UUID of the account to send to (requires shared org membership or admin access)
 *
 * @param request - The request object.
 * @returns A NextResponse with send result.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return createNotificationHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
