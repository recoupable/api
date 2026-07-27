import { NextResponse } from "next/server";
import { COLD_START_NUDGE_EMAIL_LOG_TYPE, RECOUP_FROM_EMAIL } from "@/lib/const";
import { buildColdStartNudgeEmail } from "@/lib/emails/buildColdStartNudgeEmail";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";

/**
 * Sends the cold-start nudge to one account and records the attempt in
 * `email_send_log` (raw_body carries the `cold_start_nudge_email` marker, which
 * is also the sweep's dedupe key).
 *
 * The caller has already excluded accounts marked as nudged, so this does not
 * re-check. Best-effort: never throws, so one bad address cannot abort the
 * sweep partway through.
 *
 * @returns True when a send was logged as sent.
 */
export async function sendColdStartNudgeEmail({
  accountId,
}: {
  accountId: string;
}): Promise<boolean> {
  try {
    const [accountEmail] = await selectAccountEmails({ accountIds: accountId });
    const email = accountEmail?.email;
    if (!email) return false;

    const { subject, html } = buildColdStartNudgeEmail();
    const rawBody = JSON.stringify({
      type: COLD_START_NUDGE_EMAIL_LOG_TYPE,
      to: email,
      subject,
    });

    const result = await sendEmailWithResend({
      from: RECOUP_FROM_EMAIL,
      to: [email],
      subject,
      html,
    });

    if (result instanceof NextResponse) {
      await logEmailAttempt({ rawBody, status: "send_failed", accountId });
      return false;
    }

    await logEmailAttempt({
      rawBody,
      status: "sent",
      accountId,
      resendId: result.id,
    });
    return true;
  } catch (error) {
    console.error("sendColdStartNudgeEmail failed (swallowed):", error);
    return false;
  }
}
