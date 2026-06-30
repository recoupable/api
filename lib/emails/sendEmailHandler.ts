import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import {
  validateSendEmailBody,
  type ValidatedSendEmailRequest,
} from "@/lib/emails/validateSendEmailBody";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import { logEmailAttempt, type EmailAttemptLog } from "@/lib/emails/logEmailAttempt";

/** Sends a validated email; returns the HTTP response plus the attempt to log. */
async function deliver(
  data: ValidatedSendEmailRequest,
): Promise<{ response: NextResponse; attempt: Omit<EmailAttemptLog, "rawBody"> }> {
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

/**
 * Handler for POST /api/emails. Sends to the explicit recipients via Resend,
 * reusing `processAndSendEmail`. Auth + body validation + the recipient
 * restriction live in `validateSendEmailBody`, which also returns the raw body.
 *
 * Every attempt — sent, send_failed, rejected — is recorded in `email_send_log`
 * with a single `logEmailAttempt` call, so a send is debuggable days later
 * without the ephemeral sandbox.
 */
export async function sendEmailHandler(request: NextRequest): Promise<NextResponse> {
  const validated = await validateSendEmailBody(request);

  const { response, attempt } =
    "data" in validated
      ? await deliver(validated.data)
      : { response: validated.error, attempt: { status: "rejected" as const } };

  await logEmailAttempt({ rawBody: validated.rawBody, ...attempt });
  return response;
}
