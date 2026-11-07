import { describe, it, expect } from "vitest";
import { formatMissedReportsAlert } from "../formatMissedReportsAlert";
import { reportRun, reportTask } from "./fixtures";

describe("formatMissedReportsAlert", () => {
  it("lists each missed report with its cause, account, run and notice state", () => {
    const text = formatMissedReportsAlert(
      [
        {
          task: reportTask,
          run: reportRun,
          cause: "email_rejected",
          detail: "recipient_not_allowed: a@example.com",
          customerNotified: true,
        },
        {
          task: { ...reportTask, id: "task-2", title: "Daily fan digest", account_id: "acc-2" },
          run: { ...reportRun, runId: "run_2" },
          cause: "no_email",
          detail: "no send attempted; run completed",
          customerNotified: false,
        },
      ],
      { unchecked: 0, truncated: false },
    );

    expect(text).toContain("2 scheduled reports did not send");
    expect(text).toContain(
      "Monthly Catalog Report: Luh Tyler: email rejected (recipient_not_allowed: a@example.com)",
    );
    expect(text).toContain("account acc-1, run run_1, customer emailed");
    expect(text).toContain("Daily fan digest: no email (no send attempted; run completed)");
    expect(text).toContain("account acc-2, run run_2, customer not emailed");
  });

  it("uses the singular for one report", () => {
    const text = formatMissedReportsAlert(
      [
        {
          task: reportTask,
          run: reportRun,
          cause: "plan_blocked",
          detail: "Free includes 1 task.",
          customerNotified: false,
        },
      ],
      { unchecked: 0, truncated: false },
    );
    expect(text).toContain("1 scheduled report did not send");
    expect(text).toContain("plan blocked (Free includes 1 task.)");
  });

  it("says how many runs could not be checked", () => {
    const text = formatMissedReportsAlert([], { unchecked: 2, truncated: false });
    expect(text).toContain("2 scheduled runs could not be checked");
    expect(text).not.toContain("0 scheduled reports did not send");
    expect(formatMissedReportsAlert([], { unchecked: 1, truncated: false })).toContain(
      "1 scheduled run could not be checked",
    );
  });

  // Telegram cuts messages at 4,000 characters; keep every alert readable.
  it("lists at most 10 reports and counts the rest", () => {
    const miss = {
      task: reportTask,
      run: reportRun,
      cause: "no_email" as const,
      detail: "no send attempted; run completed",
      customerNotified: false,
    };
    const text = formatMissedReportsAlert(Array(25).fill(miss), {
      unchecked: 0,
      truncated: false,
    });
    expect(text.match(/^• /gm)).toHaveLength(10);
    expect(text).toContain("…and 15 more");
    expect(text.length).toBeLessThan(4000);
  });

  it("says when the hour held more runs than one page", () => {
    expect(formatMissedReportsAlert([], { unchecked: 0, truncated: true })).toContain(
      "More than 100 runs started in that hour",
    );
  });

  it("shortens long titles and details so the alert stays within Telegram's limit", () => {
    const miss = {
      task: { ...reportTask, title: "T".repeat(500) },
      run: reportRun,
      cause: "email_rejected" as const,
      detail: "D".repeat(1000),
      customerNotified: false,
    };
    const text = formatMissedReportsAlert(Array(20).fill(miss), {
      unchecked: 0,
      truncated: false,
    });
    expect(text.length).toBeLessThan(4000);
    expect(text).toContain("…");
  });
});
