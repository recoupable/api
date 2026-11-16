import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetchTriggerRuns = vi.fn();
vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: (...args: unknown[]) => mockFetchTriggerRuns(...args),
}));

const mockRetrieveTaskRun = vi.fn();
vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: (...args: unknown[]) => mockRetrieveTaskRun(...args),
}));

const { listScheduledReportRuns } = await import("../listScheduledReportRuns");

const window = { from: "2026-11-06T10:00:00.000Z", to: "2026-11-06T11:00:00.000Z" };

describe("listScheduledReportRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("lists the scheduled task's runs in the window and resolves each to its task", async () => {
    mockFetchTriggerRuns.mockResolvedValue([
      { id: "run_1", status: "COMPLETED", createdAt: "2026-11-06T10:20:00.000Z" },
    ]);
    mockRetrieveTaskRun.mockResolvedValue({ schedule: { externalId: "task-1" } });

    const { runs } = await listScheduledReportRuns(window);

    expect(mockFetchTriggerRuns).toHaveBeenCalledWith(
      {
        "filter[taskIdentifier]": "customer-prompt-task",
        "filter[createdAt][from]": window.from,
        "filter[createdAt][to]": window.to,
      },
      100,
    );
    expect(runs).toEqual([
      {
        runId: "run_1",
        taskId: "task-1",
        createdAt: "2026-11-06T10:20:00.000Z",
        status: "COMPLETED",
      },
    ]);
  });

  it("skips runs with no task id and runs that cannot be read", async () => {
    mockFetchTriggerRuns.mockResolvedValue([
      { id: "run_manual", status: "COMPLETED", createdAt: "2026-11-06T10:01:00.000Z" },
      { id: "run_broken", status: "COMPLETED", createdAt: "2026-11-06T10:02:00.000Z" },
      { id: "run_ok", status: "FAILED", createdAt: "2026-11-06T10:03:00.000Z" },
      { id: "run_gone", status: "COMPLETED", createdAt: "2026-11-06T10:04:00.000Z" },
    ]);
    mockRetrieveTaskRun.mockImplementation(async (id: string) => {
      if (id === "run_manual") return { schedule: undefined };
      if (id === "run_gone") return null;
      if (id === "run_broken") throw new Error("trigger down");
      return { schedule: { externalId: "task-2" } };
    });

    const { runs, unreadable } = await listScheduledReportRuns(window);

    expect(runs.map(run => run.runId)).toEqual(["run_ok"]);
    // run_broken threw and run_gone came back empty; a manual run is simply not scheduled.
    expect(unreadable).toBe(2);
    expect(console.error).toHaveBeenCalled();
  });

  it("warns when the window may hold more runs than one page", async () => {
    mockFetchTriggerRuns.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        id: `run_${i}`,
        status: "COMPLETED",
        createdAt: "2026-11-06T10:00:00.000Z",
      })),
    );
    mockRetrieveTaskRun.mockResolvedValue(null);

    const { truncated } = await listScheduledReportRuns(window);

    expect(truncated).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  // One hung Trigger.dev read must not stall the whole check.
  it("gives up on a run read that does not answer in time", async () => {
    vi.useFakeTimers();
    mockFetchTriggerRuns.mockResolvedValue([
      { id: "run_hung", status: "COMPLETED", createdAt: "2026-11-06T10:01:00.000Z" },
      { id: "run_ok", status: "COMPLETED", createdAt: "2026-11-06T10:02:00.000Z" },
    ]);
    mockRetrieveTaskRun.mockImplementation((id: string) =>
      id === "run_hung"
        ? new Promise(() => {})
        : Promise.resolve({ schedule: { externalId: "task-1" } }),
    );

    const pending = listScheduledReportRuns(window);
    await vi.advanceTimersByTimeAsync(5_000);
    const { runs, unreadable } = await pending;

    expect(runs.map(run => run.runId)).toEqual(["run_ok"]);
    expect(unreadable).toBe(1);
    vi.useRealTimers();
  });
});
