import type { MissedReportCause, NotifiedMissedReport } from "./types";

const CAUSE_LABELS: Record<MissedReportCause, string> = {
  plan_blocked: "plan blocked",
  email_rejected: "email rejected",
  no_email: "no email",
};

/** Telegram cuts messages at 4,000 characters; with the field caps below, ten lines stay inside it. */
const MAX_LISTED = 10;
const MAX_TITLE = 80;
const MAX_DETAIL = 120;

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/**
 * The team's Telegram alert for scheduled reports that did not send: one
 * line per report with its cause, then the ids needed to look it up, plus
 * what could not be checked.
 *
 * @param misses - The missed reports and whether each customer was emailed.
 * @param coverage - What the check could not cover.
 * @param coverage.unchecked - Runs that could not be read or checked.
 * @param coverage.truncated - True when the hour held more runs than one page.
 * @returns Plain text for `sendMessage`.
 */
export function formatMissedReportsAlert(
  misses: NotifiedMissedReport[],
  { unchecked, truncated }: { unchecked: number; truncated: boolean },
): string {
  const count = misses.length;
  const header =
    count > 0
      ? `⚠️ ${count} scheduled report${count === 1 ? "" : "s"} did not send (runs started 2-3 hours ago)`
      : "⚠️ Missed-report check could not cover every run (runs started 2-3 hours ago)";
  const lines = misses
    .slice(0, MAX_LISTED)
    .map(
      miss =>
        `• ${clip(miss.task.title, MAX_TITLE)}: ${CAUSE_LABELS[miss.cause]} (${clip(miss.detail, MAX_DETAIL)})\n  account ${miss.task.account_id}, run ${miss.run.runId}, customer ${miss.customerNotified ? "emailed" : "not emailed"}`,
    );
  const notes = [
    ...(count > MAX_LISTED ? [`…and ${count - MAX_LISTED} more`] : []),
    ...(unchecked > 0
      ? [
          `${unchecked} scheduled run${unchecked === 1 ? "" : "s"} could not be checked; see the api logs.`,
        ]
      : []),
    ...(truncated ? ["More than 100 runs started in that hour; later ones were not checked."] : []),
  ];
  return [header, ...lines, ...notes].join("\n");
}
