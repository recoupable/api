import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateNotificationBody } from "./validateCreateNotificationBody";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Handler for POST /api/notifications.
 * Sends a notification email to the authenticated account's email address.
 * The recipient is automatically resolved from the API key or Bearer token.
 * Supports optional account_id override (requires shared org membership or admin access).
 * Requires authentication via x-api-key header or Authorization bearer token.
 *
 * @param request - The request object.
 * @returns A NextResponse with the send result.
 */
export async function createNotificationHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateCreateNotificationBody(request);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { cc = [], subject, text, html = "", headers = {}, room_id, accountId } = validated;

  // Resolve recipient email from authenticated account
  const accountEmails = await selectAccountEmails({ accountIds: accountId });
  const recipientEmail = accountEmails?.[0]?.email;

  if (!recipientEmail) {
    return NextResponse.json(
      {
        status: "error",
        error: "No email address found for the authenticated account.",
      },
      {
        status: 400,
        headers: getCorsHeaders(),
      },
    );
  }

  const result = await processAndSendEmail({
    to: [recipientEmail],
    cc,
    subject,
    text,
    html,
    headers,
    room_id,
  });

  if (result.success === false) {
    return NextResponse.json(
      {
        status: "error",
        error: result.error,
      },
      {
        status: 502,
        headers: getCorsHeaders(),
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      message: result.message,
      id: result.id,
    },
    {
      status: 200,
      headers: getCorsHeaders(),
    },
  );
}
