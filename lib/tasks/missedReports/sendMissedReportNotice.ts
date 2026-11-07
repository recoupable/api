import { NextResponse } from "next/server";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { pickAccountRecipient } from "@/lib/emails/pickAccountRecipient";
import { logEmailAttempt } from "@/lib/emails/logEmailAttempt";
import { selectEmailSendLog } from "@/lib/supabase/email_send_log/selectEmailSendLog";
import { MISSED_REPORT_NOTICE_LOG_TYPE, RECOUP_FROM_EMAIL } from "@/lib/const";
import type { MissedReport } from "./types";

/**
 * Onboarding and the homepage card create these; they always email, so a run
 * without a send is a real failure. Other tasks may email conditionally, so
 * only a plan block (certain) reaches their owners.
 */
const REPORT_TASK_TITLE = /Catalog Report:/;
/** A blocked task fires on every scheduled run; remind its owner at most this often. */
const PLAN_NOTICE_INTERVAL_MS = 30 * 24 * 60 * 60_000;

/**
 * Tells the account owner that a scheduled report did not arrive: why and
 * where to upgrade when the plan blocked it, otherwise that the team has been
 * alerted. Off unless `MISSED_REPORT_CUSTOMER_NOTICES` is "true", so the team
 * alert can run alone until the volume is known. Each run's notice carries an
 * idempotency key; plan-block notices are logged (without an account, so they
 * never count as the report being sent) and repeat at most monthly per task.
 *
 * @param miss - The missed report.
 * @returns Whether a notice was sent.
 */
export async function sendMissedReportNotice(miss: MissedReport): Promise<boolean> {
  if (process.env.MISSED_REPORT_CUSTOMER_NOTICES !== "true") return false;
  if (miss.cause !== "plan_blocked" && !REPORT_TASK_TITLE.test(miss.task.title)) return false;

  const noticeType = `${MISSED_REPORT_NOTICE_LOG_TYPE}:${miss.task.id}:${miss.cause}`;
  if (miss.cause === "plan_blocked") {
    const earlier = await selectEmailSendLog({
      rawBodyLike: noticeType,
      createdAfter: new Date(Date.now() - PLAN_NOTICE_INTERVAL_MS).toISOString(),
      limit: 1,
    });
    if (earlier.length > 0) return false;
  }

  const to = pickAccountRecipient(await selectAccountEmails({ accountIds: miss.task.account_id }));
  if (!to) return false;

  // Titles are account-entered; keep control characters out of the header.
  const plainTitle = miss.task.title.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  const title = escapeHtml(miss.task.title);
  const { subject, html } =
    miss.cause === "plan_blocked"
      ? {
          subject: `Your task didn't run: ${plainTitle}`,
          html: `<p>Your scheduled task “${title}” was due and didn't run, because your plan doesn't cover it. ${escapeHtml(miss.detail)}</p><p>Upgrade or change your tasks at <a href="${miss.billingUrl}">${miss.billingUrl}</a>, and it will run at its next scheduled time.</p>`,
        }
      : {
          subject: `Your report didn't go out: ${plainTitle}`,
          html: `<p>Your scheduled report “${title}” was due and didn't reach your inbox. We've been alerted and are looking into it.</p><p>It will run again at its next scheduled time.</p>`,
        };

  const result = await sendEmailWithResend(
    { from: RECOUP_FROM_EMAIL, to, subject, html },
    { idempotencyKey: `missed-report/${miss.run.runId}` },
  );
  if (result instanceof NextResponse) return false;

  if (miss.cause === "plan_blocked") {
    await logEmailAttempt({
      rawBody: JSON.stringify({
        type: noticeType,
        account_id: miss.task.account_id,
        run_id: miss.run.runId,
      }),
      status: "sent",
      resendId: result.id,
    });
  }
  return true;
}
