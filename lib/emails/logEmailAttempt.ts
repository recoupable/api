import { insertEmailSendLog } from "@/lib/supabase/email_send_log/insertEmailSendLog";

/** Cap the stored raw body so a 12KB+ HTML report doesn't bloat the log row. */
const MAX_RAW_BODY = 10000;

export type EmailAttemptStatus = "sent" | "send_failed" | "rejected";

export type EmailAttemptLog = {
  /** The raw request body, as received (used to record body_parsed + a truncated copy). */
  rawBody: string;
  status: EmailAttemptStatus;
  accountId?: string | null;
  to?: string[];
  subject?: string;
  html?: string;
  text?: string;
  chatId?: string;
  resendId?: string;
  error?: string;
};

/**
 * Records one POST /api/emails attempt in `email_send_log` so a send can be
 * debugged days later without the (ephemeral) sandbox — capturing whether the
 * body parsed, a truncated copy of it, the resolved fields, and the outcome.
 *
 * Best-effort: this never throws. A logging failure must not affect the send.
 *
 * @param attempt - The attempt to record.
 */
export async function logEmailAttempt(attempt: EmailAttemptLog): Promise<void> {
  let bodyParsed = false;
  try {
    if (attempt.rawBody && attempt.rawBody.trim()) {
      JSON.parse(attempt.rawBody);
      bodyParsed = true;
    }
  } catch {
    bodyParsed = false;
  }

  try {
    await insertEmailSendLog({
      account_id: attempt.accountId ?? null,
      chat_id: attempt.chatId ?? null,
      status: attempt.status,
      body_parsed: bodyParsed,
      raw_body: attempt.rawBody ? attempt.rawBody.slice(0, MAX_RAW_BODY) : null,
      to_count: attempt.to?.length ?? null,
      subject: attempt.subject ?? null,
      html_length: attempt.html?.length ?? null,
      text_length: attempt.text?.length ?? null,
      resend_id: attempt.resendId ?? null,
      error: attempt.error ?? null,
    });
  } catch {
    // Best-effort logging — swallow so the email send result is unaffected.
  }
}
