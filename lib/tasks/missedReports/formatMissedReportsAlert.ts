import type { MissedReportCause, NotifiedMissedReport } from "./types";

const CAUSE_LABELS: Record<MissedReportCause, string> = {
  plan_blocked: "plan blocked",
  email_rejected: "email rejected",
  no_email: "no email",
};

/**
 * The team's Telegram alert for scheduled reports that did not send: one
 * line per report with its cause, then the ids needed to look it up.
 *
 * @param misses - The missed reports and whether each customer was emailed.
 * @param unchecked - Runs that could not be checked (a read failed).
 * @returns Plain text for `sendMessage`.
 */
export function formatMissedReportsAlert(
  misses: NotifiedMissedReport[],
  unchecked: number,
): string {
  const count = misses.length;
  const header = `⚠️ ${count} scheduled report${count === 1 ? "" : "s"} did not send (runs started 2-3 hours ago)`;
  const uncheckedLine =
    unchecked > 0
      ? [
          `${unchecked} scheduled run${unchecked === 1 ? "" : "s"} could not be checked; see the api logs.`,
        ]
      : [];
  const lines = misses.map(
    miss =>
      `• ${miss.task.title}: ${CAUSE_LABELS[miss.cause]} (${miss.detail})\n  account ${miss.task.account_id}, run ${miss.run.runId}, customer ${miss.customerNotified ? "emailed" : "not emailed"}`,
  );
  return [header, ...lines, ...uncheckedLine].join("\n");
}
