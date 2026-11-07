import { NextResponse } from "next/server";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { escapeHtml } from "@/lib/emails/escapeHtml";
import { pickAccountRecipient } from "@/lib/emails/pickAccountRecipient";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import type { MissedReport } from "./types";

/**
 * Onboarding and the homepage card create these; they always email, so a run
 * without a send is a real failure. Other tasks may email conditionally, so
 * only a plan block (certain) reaches their owners.
 */
const REPORT_TASK_TITLE = /Catalog Report:/;

/**
 * Tells the account owner that a scheduled report did not arrive: why and
 * where to upgrade when the plan blocked it, otherwise that the team has been
 * alerted. Off unless `MISSED_REPORT_CUSTOMER_NOTICES` is "true", so the team
 * alert can run alone until the volume is known.
 *
 * @param miss - The missed report.
 * @returns Whether a notice was sent.
 */
export async function sendMissedReportNotice(miss: MissedReport): Promise<boolean> {
  if (process.env.MISSED_REPORT_CUSTOMER_NOTICES !== "true") return false;
  if (miss.cause !== "plan_blocked" && !REPORT_TASK_TITLE.test(miss.task.title)) return false;

  const to = pickAccountRecipient(await selectAccountEmails({ accountIds: miss.task.account_id }));
  if (!to) return false;

  const title = escapeHtml(miss.task.title);
  const { subject, html } =
    miss.cause === "plan_blocked"
      ? {
          subject: `Your task didn't run: ${miss.task.title}`,
          html: `<p>Your scheduled task “${title}” was due and didn't run, because your plan doesn't cover it. ${escapeHtml(miss.detail)}</p><p>Upgrade or change your tasks at <a href="${miss.billingUrl}">${miss.billingUrl}</a>, and it will run at its next scheduled time.</p>`,
        }
      : {
          subject: `Your report didn't go out: ${miss.task.title}`,
          html: `<p>Your scheduled report “${title}” was due and didn't reach your inbox. We've been alerted and are looking into it.</p><p>It will run again at its next scheduled time. Questions? Reply to this email.</p>`,
        };

  const result = await sendEmailWithResend({ from: RECOUP_FROM_EMAIL, to, subject, html });
  return !(result instanceof NextResponse);
}
