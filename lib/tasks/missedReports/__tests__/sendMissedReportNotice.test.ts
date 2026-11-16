import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { reportRun, reportTask } from "./fixtures";
import type { MissedReport } from "../types";

const mockSelectAccountEmails = vi.fn();
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: (...args: unknown[]) => mockSelectAccountEmails(...args),
}));

const mockSend = vi.fn();
vi.mock("@/lib/emails/sendEmail", () => ({
  sendEmailWithResend: (...args: unknown[]) => mockSend(...args),
}));

const mockSelectEmailSendLog = vi.fn();
vi.mock("@/lib/supabase/email_send_log/selectEmailSendLog", () => ({
  selectEmailSendLog: (...args: unknown[]) => mockSelectEmailSendLog(...args),
}));

const mockLogEmailAttempt = vi.fn();
vi.mock("@/lib/emails/logEmailAttempt", () => ({
  logEmailAttempt: (...args: unknown[]) => mockLogEmailAttempt(...args),
}));

const { sendMissedReportNotice } = await import("../sendMissedReportNotice");

const rejected: MissedReport = {
  task: reportTask,
  run: reportRun,
  cause: "email_rejected",
  detail: "recipient_not_allowed: a@example.com",
};
const blocked: MissedReport = {
  task: { ...reportTask, title: "Daily <fan> digest" },
  run: reportRun,
  cause: "plan_blocked",
  detail: "Free runs tasks weekly at most. Starter runs daily, Pro runs hourly.",
  billingUrl: "https://app.recoupable.dev/plan",
};

describe("sendMissedReportNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MISSED_REPORT_CUSTOMER_NOTICES", "true");
    mockSelectAccountEmails.mockResolvedValue([{ email: "owner@example.com" }]);
    mockSend.mockResolvedValue({ id: "re_1" });
    mockSelectEmailSendLog.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends nothing while customer notices are switched off", async () => {
    vi.stubEnv("MISSED_REPORT_CUSTOMER_NOTICES", "");
    expect(await sendMissedReportNotice(rejected)).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("tells the account owner a report did not arrive", async () => {
    expect(await sendMissedReportNotice(rejected)).toBe(true);
    expect(mockSelectAccountEmails).toHaveBeenCalledWith({ accountIds: "acc-1" });
    const email = mockSend.mock.calls[0][0];
    expect(email.to).toBe("owner@example.com");
    expect(email.subject).toBe("Your report didn't go out: Monthly Catalog Report: Luh Tyler");
    expect(email.html).toContain("We've been alerted");
    expect(email.html).not.toMatch(/reply/i);
    // A duplicate cron delivery for the same run must not email twice.
    expect(mockSend.mock.calls[0][1]).toEqual({ idempotencyKey: "missed-report/run_1" });
  });

  // A blocked task fires on every scheduled run; tell the owner once a month,
  // not every hour. The notice log row carries no account_id, so it never
  // counts as the account's report being sent.
  it("sends a plan-block notice once per task per 30 days and logs it without an account", async () => {
    expect(await sendMissedReportNotice(blocked)).toBe(true);
    expect(mockSelectEmailSendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        rawBodyLike: "missed_report_notice:task-1:plan_blocked",
        limit: 1,
      }),
    );
    expect(mockLogEmailAttempt).toHaveBeenCalledWith({
      rawBody: JSON.stringify({
        type: "missed_report_notice:task-1:plan_blocked",
        account_id: "acc-1",
        run_id: "run_1",
      }),
      status: "sent",
      resendId: "re_1",
    });

    vi.clearAllMocks();
    mockSelectEmailSendLog.mockResolvedValue([{ id: "earlier-notice" }]);
    expect(await sendMissedReportNotice(blocked)).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("explains a plan block with the upgrade link, escaping the task title", async () => {
    expect(await sendMissedReportNotice(blocked)).toBe(true);
    const email = mockSend.mock.calls[0][0];
    expect(email.subject).toBe("Your task didn't run: Daily <fan> digest");
    expect(email.html).toContain("Daily &lt;fan&gt; digest");
    expect(email.html).toContain("Free runs tasks weekly at most.");
    expect(email.html).toContain('href="https://app.recoupable.dev/plan"');
  });

  it("only emails about other failures for the catalog report tasks", async () => {
    const custom = { ...rejected, task: { ...reportTask, title: "Daily fan digest" } };
    expect(await sendMissedReportNotice(custom)).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns false when the account has no email or the send fails", async () => {
    mockSelectAccountEmails.mockResolvedValue([]);
    expect(await sendMissedReportNotice(rejected)).toBe(false);

    mockSelectAccountEmails.mockResolvedValue([{ email: "owner@example.com" }]);
    mockSend.mockResolvedValue(NextResponse.json({ error: "x" }, { status: 502 }));
    expect(await sendMissedReportNotice(rejected)).toBe(false);
  });

  it("keeps line breaks in a task title out of the subject", async () => {
    await sendMissedReportNotice({
      ...rejected,
      task: { ...reportTask, title: "Monthly Catalog Report: A\r\nBcc: x@example.com" },
    });
    expect(mockSend.mock.calls[0][0].subject).toBe(
      "Your report didn't go out: Monthly Catalog Report: A Bcc: x@example.com",
    );
  });
});
