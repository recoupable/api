import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { sendEmailHandler } from "@/lib/emails/sendEmailHandler";

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
 * POST /api/emails
 *
 * Sends an email to one or more explicit recipients via Resend. Emails are sent
 * from `Agent by Recoup <agent@recoupable.com>`. Account-scoped — requires
 * authentication via x-api-key header or Authorization Bearer token.
 *
 * Body parameters:
 * - to (required): array of recipient email addresses
 * - subject (required): email subject line
 * - text (optional): plain text / Markdown body
 * - html (optional): raw HTML body (takes precedence over text)
 * - cc (optional): array of CC email addresses
 * - headers (optional): custom email headers
 * - room_id (optional): room ID for a chat link in the footer
 * - account_id (optional): UUID of the account to send for (org keys only)
 *
 * @param request - The request object.
 * @returns A NextResponse with the send result.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return sendEmailHandler(request);
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
