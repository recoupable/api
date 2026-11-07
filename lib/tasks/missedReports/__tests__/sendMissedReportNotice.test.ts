import { describe, it, expect, vi, beforeEach } from "vitest";
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
  });

  it("sends nothing while customer notices are switched off", async () => {
    vi.stubEnv("MISSED_REPORT_CUSTOMER_NOTICES", "");
    expect(await sendMissedReportNotice(rejected)).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("tells the account owner a report did not arrive", async () => {
    expect(await sendMissedReportNotice(rejected)).toBe(true);
    const email = mockSend.mock.calls[0][0];
    expect(email.to).toBe("owner@example.com");
    expect(email.subject).toBe("Your report didn't go out: Monthly Catalog Report: Luh Tyler");
    expect(email.html).toContain("We've been alerted");
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
});
