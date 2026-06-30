import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateSendEmailBody } from "@/lib/emails/validateSendEmailBody";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";

/** Read the raw request body without consuming it (validation reads the original). */
async function readRawBody(request: NextRequest): Promise<string> {
  try {
    return await request.clone().text();
  } catch {
    return "";
  }
}

/**
 * Handler for POST /api/emails.
 *
 * Sends an email to the explicit recipients in the request body via Resend
 * (from `Agent by Recoup <agent@recoupable.dev>`), reusing the same
 * `processAndSendEmail` domain function as the `send_email` MCP tool.
 * Account-scoped: requires authentication via x-api-key or Authorization Bearer.
 * Body validation, auth, and the recipient restriction all live in
 * `validateSendEmailBody`.
 *
 * Every attempt — sent, send-failed, and rejected (e.g. an empty/malformed
 * body) — is recorded in `email_send_log` via `logEmailAttempt`, so a send can
 * be debugged days later without the ephemeral sandbox that built the request.
 *
 * @param request - The request object.
 * @returns A NextResponse with the send result.
 */
export async function sendEmailHandler(request: NextRequest): Promise<NextResponse> {
  const rawBody = await readRawBody(request);

  const validated = await validateSendEmailBody(request);
  if (validated instanceof NextResponse) {
    await logEmailAttempt({ rawBody, status: "rejected" });
    return validated;
  }

  const { to, cc = [], subject, text, html = "", headers = {}, chat_id } = validated;

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
    await logEmailAttempt({
      rawBody,
      status: "send_failed",
      accountId: validated.accountId,
      to,
      subject,
      html,
      text,
      chatId: chat_id,
      error: result.error,
    });
    return NextResponse.json(
      { status: "error", error: result.error },
      { status: 502, headers: getCorsHeaders() },
    );
  }

  await logEmailAttempt({
    rawBody,
    status: "sent",
    accountId: validated.accountId,
    to,
    subject,
    html,
    text,
    chatId: chat_id,
    resendId: result.id,
  });

  return NextResponse.json(
    { success: true, message: result.message, id: result.id },
    { status: 200, headers: getCorsHeaders() },
  );
}
