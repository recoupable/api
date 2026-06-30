import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSendEmailBody } from "@/lib/emails/validateSendEmailBody";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import { logEmailAttempt, type EmailAttemptLog } from "@/lib/emails/logEmailAttempt";

/**
 * Handler for POST /api/emails. Auth + body validation + the recipient
 * restriction live in `validateSendEmailBody` (which also returns the raw body).
 * Here we send the validated email via Resend, shape the response, and record
 * the attempt.
 *
 * Every outcome — sent, send_failed, rejected — is resolved into a single
 * `{ response, attempt }` and logged with ONE `logEmailAttempt` call, so a send
 * is debuggable days later without the ephemeral sandbox.
 */
export async function sendEmailHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSendEmailBody(request);

  let response: NextResponse;
  let attempt: Omit<EmailAttemptLog, "rawBody">;

  if ("data" in validated) {
    const {
      to,
      cc = [],
      subject,
      text,
      html = "",
      headers = {},
      chat_id,
      accountId,
    } = validated.data;
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
      response = NextResponse.json(
        { status: "error", error: result.error },
        { status: 502, headers: getCorsHeaders() },
      );
      attempt = { status: "send_failed", accountId, chatId: chat_id };
    } else {
      response = NextResponse.json(
        { success: true, message: result.message, id: result.id },
        { status: 200, headers: getCorsHeaders() },
      );
      attempt = { status: "sent", accountId, chatId: chat_id, resendId: result.id };
    }
  } else {
    response = validated.error;
    attempt = { status: "rejected" };
  }

  await logEmailAttempt({ rawBody: validated.rawBody, ...attempt });
  return response;
}
