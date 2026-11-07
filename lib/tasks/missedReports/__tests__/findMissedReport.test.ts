import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportRun, reportTask } from "./fixtures";

const mockSelectEmailSendLog = vi.fn();
vi.mock("@/lib/supabase/email_send_log/selectAccountEmailAttempts", () => ({
  selectAccountEmailAttempts: (...args: unknown[]) => mockSelectEmailSendLog(...args),
}));

const mockGetTaskRunBlock = vi.fn();
vi.mock("@/lib/plans/getTaskRunBlock", () => ({
  getTaskRunBlock: (...args: unknown[]) => mockGetTaskRunBlock(...args),
}));

const { findMissedReport } = await import("../findMissedReport");

const row = (status: string, created_at: string, reason: string | null = null) => ({
  id: created_at,
  account_id: "acc-1",
  chat_id: null,
  created_at,
  raw_body: "{}",
  reason,
  resend_id: null,
  status,
});

describe("findMissedReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectEmailSendLog.mockResolvedValue([]);
    mockGetTaskRunBlock.mockResolvedValue(null);
  });

  it("ignores a task whose prompt never asks for an email", async () => {
    const result = await findMissedReport({
      run: reportRun,
      task: { ...reportTask, prompt: "Summarize this week's streams in the chat." },
    });
    expect(result).toBeNull();
    expect(mockSelectEmailSendLog).not.toHaveBeenCalled();
  });

  it("is not missed when the account sent an email after the run started", async () => {
    mockSelectEmailSendLog.mockResolvedValue([row("sent", "2026-11-06T10:50:00.000Z")]);
    expect(await findMissedReport({ run: reportRun, task: reportTask })).toBeNull();
    expect(mockSelectEmailSendLog).toHaveBeenCalledWith({
      accountId: "acc-1",
      since: reportRun.createdAt,
    });
  });

  it("names the plan limit when the plan blocked the run", async () => {
    mockGetTaskRunBlock.mockResolvedValue({
      message: "Free includes 1 task. Starter includes 3, Pro is unlimited.",
      billingUrl: "https://app.recoupable.dev/plan",
    });
    expect(await findMissedReport({ run: reportRun, task: reportTask })).toEqual({
      task: reportTask,
      run: reportRun,
      cause: "plan_blocked",
      detail: "Free includes 1 task. Starter includes 3, Pro is unlimited.",
      billingUrl: "https://app.recoupable.dev/plan",
    });
  });

  it("reports the latest rejection reason when the send was refused", async () => {
    mockSelectEmailSendLog.mockResolvedValue([
      row("rejected", "2026-11-06T10:40:00.000Z", "invalid_body: html: empty"),
      row("rejected", "2026-11-06T10:45:00.000Z", "recipient_not_allowed: a@example.com"),
    ]);
    const result = await findMissedReport({ run: reportRun, task: reportTask });
    expect(result).toMatchObject({
      cause: "email_rejected",
      detail: "recipient_not_allowed: a@example.com",
    });
  });

  // The block is read at check time; a send attempt proves the run went ahead.
  it("reports the rejection, not the plan, when the run attempted a send", async () => {
    mockGetTaskRunBlock.mockResolvedValue({ message: "Free includes 1 task.", billingUrl: "x" });
    mockSelectEmailSendLog.mockResolvedValue([
      row("rejected", "2026-11-06T10:40:00.000Z", "invalid_body: html: empty"),
    ]);
    const result = await findMissedReport({ run: reportRun, task: reportTask });
    expect(result).toMatchObject({ cause: "email_rejected" });
    expect(mockGetTaskRunBlock).not.toHaveBeenCalled();
  });

  // An unreadable log is unknown, not "nothing sent": never tell a customer
  // their report failed because of our own read error.
  it("throws when the email log cannot be read", async () => {
    mockSelectEmailSendLog.mockRejectedValue(new Error("db down"));
    await expect(findMissedReport({ run: reportRun, task: reportTask })).rejects.toThrow("db down");
  });

  it("falls back to the run status when no send was attempted", async () => {
    const result = await findMissedReport({
      run: { ...reportRun, status: "FAILED" },
      task: reportTask,
    });
    expect(result).toMatchObject({ cause: "no_email", detail: "no send attempted; run failed" });
  });
});
