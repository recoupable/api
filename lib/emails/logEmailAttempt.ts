import { insertEmailSendLog } from "@/lib/supabase/email_send_log/insertEmailSendLog";

export type EmailAttemptStatus = "sent" | "send_failed" | "rejected";

export type EmailAttemptLog = {
  /** The request body as received (stored in full; "" when empty/unreadable). */
  rawBody: string;
  status: EmailAttemptStatus;
  accountId?: string | null;
  chatId?: string | null;
  resendId?: string;
};

/**
 * Records one POST /api/emails attempt in `email_send_log` so a send can be
 * debugged days later without the (ephemeral) sandbox.
 *
 * Best-effort: never throws (a logging failure must not affect the send), but a
 * failed write IS surfaced to server logs so observability gaps are visible.
 *
 * @param attempt - The attempt to record.
 */
export async function logEmailAttempt(attempt: EmailAttemptLog): Promise<void> {
  try {
    const { error } = await insertEmailSendLog({
      account_id: attempt.accountId ?? null,
      chat_id: attempt.chatId ?? null,
      status: attempt.status,
      resend_id: attempt.resendId ?? null,
      raw_body: attempt.rawBody,
    });
    if (error) {
      console.error("email_send_log insert failed:", error);
    }
  } catch (err) {
    console.error("logEmailAttempt threw (swallowed):", err);
  }
}
