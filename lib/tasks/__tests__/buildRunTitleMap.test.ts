import { describe, it, expect, vi, beforeEach } from "vitest";

import { buildRunTitleMap } from "../buildRunTitleMap";
import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";

vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: vi.fn(),
}));

const baseRun = {
  status: "COMPLETED",
  createdAt: "2026-07-07T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  durationMs: 1000,
};

describe("buildRunTitleMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps run ids from schedule-filtered runs to the action's title", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValueOnce([
      { ...baseRun, id: "run_a" },
      { ...baseRun, id: "run_b" },
    ]);

    const map = await buildRunTitleMap(
      [{ title: "Weekly valuation + streams report", trigger_schedule_id: "sched_1" }],
      20,
    );

    expect(fetchTriggerRuns).toHaveBeenCalledWith({ "filter[schedule]": "sched_1" }, 20);
    expect(map.get("run_a")).toBe("Weekly valuation + streams report");
    expect(map.get("run_b")).toBe("Weekly valuation + streams report");
  });

  it("fetches once per schedule and merges entries across actions", async () => {
    vi.mocked(fetchTriggerRuns)
      .mockResolvedValueOnce([{ ...baseRun, id: "run_a" }])
      .mockResolvedValueOnce([{ ...baseRun, id: "run_b" }]);

    const map = await buildRunTitleMap(
      [
        { title: "Task One", trigger_schedule_id: "sched_1" },
        { title: "Task Two", trigger_schedule_id: "sched_2" },
      ],
      5,
    );

    expect(fetchTriggerRuns).toHaveBeenCalledTimes(2);
    expect(map.get("run_a")).toBe("Task One");
    expect(map.get("run_b")).toBe("Task Two");
  });

  it("skips actions without a trigger_schedule_id", async () => {
    const map = await buildRunTitleMap([{ title: "Unlinked task", trigger_schedule_id: null }], 20);

    expect(fetchTriggerRuns).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });

  it("fails open per action when a Trigger.dev fetch throws", async () => {
    vi.mocked(fetchTriggerRuns)
      .mockRejectedValueOnce(new Error("Trigger.dev API error: 500"))
      .mockResolvedValueOnce([{ ...baseRun, id: "run_b" }]);

    const map = await buildRunTitleMap(
      [
        { title: "Broken schedule", trigger_schedule_id: "sched_1" },
        { title: "Working schedule", trigger_schedule_id: "sched_2" },
      ],
      20,
    );

    expect(map.size).toBe(1);
    expect(map.get("run_b")).toBe("Working schedule");
  });

  it("returns an empty map for an empty actions list", async () => {
    const map = await buildRunTitleMap([], 20);

    expect(fetchTriggerRuns).not.toHaveBeenCalled();
    expect(map.size).toBe(0);
  });
});
