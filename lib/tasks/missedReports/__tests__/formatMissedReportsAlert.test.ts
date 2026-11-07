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
      0,
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
      0,
    );
    expect(text).toContain("1 scheduled report did not send");
    expect(text).toContain("plan blocked (Free includes 1 task.)");
  });

  it("says how many runs could not be checked", () => {
    expect(formatMissedReportsAlert([], 2)).toContain("2 scheduled runs could not be checked");
    expect(formatMissedReportsAlert([], 1)).toContain("1 scheduled run could not be checked");
  });
});
