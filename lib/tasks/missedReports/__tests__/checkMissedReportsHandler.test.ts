import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { reportRun, reportTask } from "./fixtures";

const mockValidate = vi.fn();
vi.mock("@/lib/internal/validateCronRequest", () => ({
  validateCronRequest: (...args: unknown[]) => mockValidate(...args),
}));
const mockListRuns = vi.fn();
vi.mock("../listScheduledReportRuns", () => ({
  listScheduledReportRuns: (...args: unknown[]) => mockListRuns(...args),
}));
const mockSelectTasks = vi.fn();
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: (...args: unknown[]) => mockSelectTasks(...args),
}));
const mockFindMissed = vi.fn();
vi.mock("../findMissedReport", () => ({
  findMissedReport: (...args: unknown[]) => mockFindMissed(...args),
}));
const mockNotice = vi.fn();
vi.mock("../sendMissedReportNotice", () => ({
  sendMissedReportNotice: (...args: unknown[]) => mockNotice(...args),
}));
const mockSendMessage = vi.fn();
vi.mock("@/lib/telegram/sendMessage", () => ({
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

const { checkMissedReportsHandler } = await import("../checkMissedReportsHandler");

const request = () => new NextRequest("http://localhost/api/internal/missed-report-check");
const miss = { task: reportTask, run: reportRun, cause: "no_email", detail: "run completed" };

describe("checkMissedReportsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T13:17:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockValidate.mockReturnValue(null);
    mockListRuns.mockResolvedValue([reportRun]);
    mockSelectTasks.mockResolvedValue([reportTask]);
    mockFindMissed.mockResolvedValue(null);
    mockNotice.mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it("rejects callers other than Vercel Cron", async () => {
    mockValidate.mockReturnValue(NextResponse.json({}, { status: 401 }));
    const response = await checkMissedReportsHandler(request());
    expect(response.status).toBe(401);
    expect(mockListRuns).not.toHaveBeenCalled();
  });

  // Hour-aligned windows ending two hours back: each run lands in one window
  // whatever second the cron fires, after a two-hour grace for long reports.
  it("checks the clock hour that started two to three hours ago", async () => {
    await checkMissedReportsHandler(request());
    expect(mockListRuns).toHaveBeenCalledWith({
      from: "2026-11-06T10:00:00.000Z",
      to: "2026-11-06T10:59:59.999Z",
    });
    vi.setSystemTime(new Date("2026-11-06T13:17:59.000Z"));
    await checkMissedReportsHandler(request());
    expect(mockListRuns).toHaveBeenLastCalledWith({
      from: "2026-11-06T10:00:00.000Z",
      to: "2026-11-06T10:59:59.999Z",
    });
  });

  it("stays quiet when every report went out", async () => {
    const response = await checkMissedReportsHandler(request());
    expect(await response.json()).toEqual({
      status: "ok",
      checked: 1,
      missed: 0,
      notified: 0,
      unchecked: 0,
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("emails the customer and alerts the team about a missed report", async () => {
    mockFindMissed.mockResolvedValue(miss);
    const response = await checkMissedReportsHandler(request());
    expect(await response.json()).toEqual({
      status: "ok",
      checked: 1,
      missed: 1,
      notified: 1,
      unchecked: 0,
    });
    expect(mockNotice).toHaveBeenCalledWith(miss);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][0]).toContain("customer emailed");
  });

  it("skips runs whose task was deleted or turned off", async () => {
    mockListRuns.mockResolvedValue([reportRun, { ...reportRun, runId: "run_2", taskId: "gone" }]);
    mockSelectTasks.mockImplementation(async ({ id }: { id: string }) =>
      id === "gone" ? [] : [{ ...reportTask, enabled: false }],
    );
    await checkMissedReportsHandler(request());
    expect(mockFindMissed).not.toHaveBeenCalled();
  });

  it("still alerts the team when the customer notice throws", async () => {
    mockFindMissed.mockResolvedValue(miss);
    mockNotice.mockRejectedValue(new Error("resend down"));
    const response = await checkMissedReportsHandler(request());
    expect(await response.json()).toMatchObject({ missed: 1, notified: 0 });
    expect(mockSendMessage.mock.calls[0][0]).toContain("customer not emailed");
  });

  it("keeps checking, and still alerts, when one run cannot be checked", async () => {
    mockListRuns.mockResolvedValue([
      { ...reportRun, runId: "run_bad", taskId: "task-bad" },
      reportRun,
    ]);
    mockSelectTasks.mockImplementation(async ({ id }: { id: string }) => {
      if (id === "task-bad") throw new Error("db down");
      return [reportTask];
    });
    mockFindMissed.mockResolvedValue(miss);

    const response = await checkMissedReportsHandler(request());

    expect(await response.json()).toMatchObject({ missed: 1, unchecked: 1 });
    expect(mockSendMessage.mock.calls[0][0]).toContain("1 scheduled run could not be checked");
  });

  it("returns 500 when the run list cannot be read", async () => {
    mockListRuns.mockRejectedValue(new Error("trigger down"));
    const response = await checkMissedReportsHandler(request());
    expect(response.status).toBe(500);
  });
});
