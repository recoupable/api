import { NextResponse } from "next/server";
import { RECOUP_FROM_EMAIL, WELCOME_EMAIL_LOG_TYPE } from "@/lib/const";
import { buildWelcomeEmail } from "@/lib/emails/buildWelcomeEmail";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { selectWelcomeEmailLog } from "@/lib/supabase/email_send_log/selectWelcomeEmailLog";

/**
 * Sends the one-time welcome email to a newly created account and records the
 * attempt in `email_send_log` (raw_body carries the `welcome_email` marker).
 *
 * Idempotent: skips the send when a sent welcome row already exists for the
 * account. Best-effort: never throws, so a Resend or DB failure can never
 * break account creation.
 *
 * @param accountId - The newly created account's id.
 * @param email - The email address linked to the account.
 */
export async function sendWelcomeEmail({
  accountId,
  email,
}: {
  accountId: string;
  email: string;
}): Promise<void> {
  try {
    const alreadySent = await selectWelcomeEmailLog(accountId);
    if (alreadySent) {
      return;
    }

    const { subject, html } = buildWelcomeEmail();
    const rawBody = JSON.stringify({ type: WELCOME_EMAIL_LOG_TYPE, to: email, subject });

    const result = await sendEmailWithResend({
      from: RECOUP_FROM_EMAIL,
      to: [email],
      subject,
      html,
    });

    if (result instanceof NextResponse) {
      await logEmailAttempt({ rawBody, status: "send_failed", accountId });
      return;
    }

    await logEmailAttempt({ rawBody, status: "sent", accountId, resendId: result.id });
  } catch (error) {
    console.error("sendWelcomeEmail failed (swallowed):", error);
  }
}
