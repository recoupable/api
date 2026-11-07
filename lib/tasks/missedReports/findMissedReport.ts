import type { Tables } from "@/types/database.types";
import { selectAccountEmailAttempts } from "@/lib/supabase/email_send_log/selectAccountEmailAttempts";
import { getTaskRunBlock } from "@/lib/plans/getTaskRunBlock";
import type { MissedReport, ScheduledReportRun } from "./types";

/** Only tasks that ask for an email can be checked against email_send_log. */
const EMAILS = /\bemail/i;

/**
 * Whether a scheduled run that asked for an email failed to send one, and
 * why. "Sent" is any successful send from the task's account after the run
 * started, so two of an account's tasks firing together can mask each other.
 * The plan is read now, not at run time, so it only explains a run that
 * attempted no send. Throws when the email log cannot be read.
 *
 * @param input - The run and the task it ran.
 * @param input.run - The scheduled run.
 * @param input.task - Its `scheduled_actions` row.
 * @returns The miss and its cause, or null when nothing is missing.
 */
export async function findMissedReport({
  run,
  task,
}: {
  run: ScheduledReportRun;
  task: Tables<"scheduled_actions">;
}): Promise<MissedReport | null> {
  if (!EMAILS.test(task.prompt)) return null;

  const attempts = await selectAccountEmailAttempts({
    accountId: task.account_id,
    since: run.createdAt,
  });
  if (attempts.some(attempt => attempt.status === "sent")) return null;

  const block = attempts.length === 0 ? await getTaskRunBlock(task) : null;
  if (block) {
    return {
      task,
      run,
      cause: "plan_blocked",
      detail: block.message,
      billingUrl: block.billingUrl,
    };
  }

  const [latestFailure] = attempts.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (latestFailure) {
    return {
      task,
      run,
      cause: "email_rejected",
      detail: latestFailure.reason ?? latestFailure.status,
    };
  }

  return {
    task,
    run,
    cause: "no_email",
    detail: `no send attempted; run ${run.status.toLowerCase()}`,
  };
}
