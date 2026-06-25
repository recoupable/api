import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSendEmailBody } from "@/lib/emails/validateSendEmailBody";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";

/**
 * Handler for POST /api/emails.
 *
 * Sends an email to the explicit recipients in the request body via Resend
 * (from `Agent by Recoup <agent@recoupable.com>`), reusing the same
 * `processAndSendEmail` domain function as the `send_email` MCP tool.
 * Account-scoped: requires authentication via x-api-key or Authorization Bearer.
 *
 * @param request - The request object.
 * @returns A NextResponse with the send result.
 */
export async function sendEmailHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSendEmailBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { to, cc = [], subject, text, html = "", headers = {}, room_id } = validated;

  const result = await processAndSendEmail({ to, cc, subject, text, html, headers, room_id });

  if (result.success === false) {
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 502, headers: getCorsHeaders() },
    );
  }

  return NextResponse.json(
    { success: true, message: result.message, id: result.id },
    { status: 200, headers: getCorsHeaders() },
  );
}
