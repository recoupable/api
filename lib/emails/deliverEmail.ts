import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import type { ValidatedSendEmailRequest } from "@/lib/emails/validateSendEmailBody";
import type { EmailAttemptLog } from "@/lib/emails/logEmailAttempt";

export type DeliverEmailResult = {
  /** The HTTP response to return to the caller. */
  response: NextResponse;
  /** The attempt to record (status + ids); the caller supplies `rawBody`. */
  attempt: Omit<EmailAttemptLog, "rawBody">;
};

/**
 * Sends a validated email via Resend (`processAndSendEmail`) and shapes both the
 * HTTP response and the attempt to log, so the handler records every outcome in
 * one place. `chat_id` maps to the internal `room_id` footer arg.
 *
 * @param data - The validated send-email request.
 * @returns The HTTP response plus the attempt to log (`sent` or `send_failed`).
 */
export async function deliverEmail(data: ValidatedSendEmailRequest): Promise<DeliverEmailResult> {
  const { to, cc = [], subject, text, html = "", headers = {}, chat_id, accountId } = data;

  const result = await processAndSendEmail({
    to,
    cc,
    subject,
    text,
    html,
    headers,
    room_id: chat_id,
  });

  if (result.success === false) {
    return {
      response: NextResponse.json(
        { status: "error", error: result.error },
        { status: 502, headers: getCorsHeaders() },
      ),
      attempt: { status: "send_failed", accountId, chatId: chat_id },
    };
  }

  return {
    response: NextResponse.json(
      { success: true, message: result.message, id: result.id },
      { status: 200, headers: getCorsHeaders() },
    ),
    attempt: { status: "sent", accountId, chatId: chat_id, resendId: result.id },
  };
}
