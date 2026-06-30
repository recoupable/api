import { insertEmailSendLog } from "@/lib/supabase/email_send_log/insertEmailSendLog";

export type EmailAttemptStatus = "sent" | "send_failed" | "rejected";

export type EmailAttemptLog = {
  /** The raw request body, as received (stored in full). */
  rawBody: string;
  status: EmailAttemptStatus;
  accountId?: string | null;
  chatId?: string | null;
  resendId?: string;
};

/**
 * Records one POST /api/emails attempt in `email_send_log` so a send can be
 * debugged days later without the (ephemeral) sandbox — the request body as
 * received, the outcome, and pointers to the account/chat and the Resend id.
 *
 * Best-effort: this never throws. A logging failure must not affect the send.
 *
 * @param attempt - The attempt to record.
 */
export async function logEmailAttempt(attempt: EmailAttemptLog): Promise<void> {
  try {
    await insertEmailSendLog({
      account_id: attempt.accountId ?? null,
      chat_id: attempt.chatId ?? null,
      status: attempt.status,
      resend_id: attempt.resendId ?? null,
      raw_body: attempt.rawBody || null,
    });
  } catch {
    // Best-effort logging — swallow so the email send result is unaffected.
  }
}
