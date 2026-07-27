import { NextResponse } from "next/server";
import {
  RECOUP_FROM_EMAIL,
  SCHEDULE_CONFIRMATION_EMAIL_LOG_TYPE,
} from "@/lib/const";
import { buildScheduleConfirmationEmail } from "@/lib/emails/buildScheduleConfirmationEmail";
import { describeCronCadence } from "@/lib/emails/describeCronCadence";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";

/**
 * Confirms a newly created schedule to the account holder, and records the
 * attempt in `email_send_log` (raw_body carries the
 * `schedule_confirmation_email` marker plus the task id).
 *
 * Fires from the handler that owns the milestone, after the schedule is
 * materialized — the same rule the welcome and valuation emails follow.
 *
 * Idempotent per task: a task id already marked sent is skipped, so a retried
 * create can't double-send. Best-effort: never throws, so a Resend or DB
 * failure can never fail task creation.
 */
export async function sendScheduleConfirmationEmail({
  accountId,
  taskId,
  title,
  schedule,
  timeZone,
}: {
  accountId: string;
  taskId: string;
  title: string;
  schedule: string;
  timeZone?: string;
}): Promise<void> {
  try {
    const marker = `"task_id":"${taskId}"`;
    const alreadySent = await selectEmailSendLog({
      accountId,
      status: "sent",
      rawBodyLike: marker,
      limit: 1,
    });
    if (alreadySent.length > 0) {
      return;
    }

    const [accountEmail] = await selectAccountEmails({ accountIds: accountId });
    const email = accountEmail?.email;
    if (!email) {
      // A wallet/phone-only login has no address to confirm to; the schedule
      // itself is unaffected.
      return;
    }

    const { subject, html } = buildScheduleConfirmationEmail({
      title,
      cadence: describeCronCadence(schedule, timeZone),
    });
    const rawBody = JSON.stringify({
      type: SCHEDULE_CONFIRMATION_EMAIL_LOG_TYPE,
      task_id: taskId,
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
      return;
    }

    await logEmailAttempt({
      rawBody,
      status: "sent",
      accountId,
      resendId: result.id,
    });
  } catch (error) {
    console.error("sendScheduleConfirmationEmail failed (swallowed):", error);
  }
}
