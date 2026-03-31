import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichTaskWithTriggerInfo } from "../enrichTaskWithTriggerInfo";
import { fetchTriggerRuns } from "@/lib/trigger/fetchTriggerRuns";
import { retrieveTaskRun } from "@/lib/trigger/retrieveTaskRun";

vi.mock("@/lib/trigger/fetchTriggerRuns", () => ({
  fetchTriggerRuns: vi.fn(),
}));

vi.mock("@/lib/trigger/retrieveTaskRun", () => ({
  retrieveTaskRun: vi.fn(),
}));

const mockTask = {
  id: "task-123",
  title: "Test Task",
  prompt: "Do something",
  schedule: "0 9 * * *",
  account_id: "account-456",
  artist_account_id: "artist-789",
  trigger_schedule_id: "sched_abc",
  enabled: true,
  created_at: "2026-01-01T00:00:00Z",
  next_run: null,
  last_run: null,
  model: null,
  timezone: null,
} as Parameters<typeof enrichTaskWithTriggerInfo>[0];

const mockRun = {
  id: "run_xyz",
  status: "COMPLETED",
  createdAt: "2026-03-20T09:00:00.000Z",
  startedAt: "2026-03-20T09:00:01.000Z",
  finishedAt: "2026-03-20T09:01:00.000Z",
  durationMs: 59000,
};

describe("enrichTaskWithTriggerInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent_runs and upcoming from Trigger.dev", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun] as never);
    vi.mocked(retrieveTaskRun).mockResolvedValue({
      ...mockRun,
      payload: {
        upcoming: ["2026-03-27T09:00:00Z", "2026-04-03T09:00:00Z"],
      },
    } as never);

    const result = await enrichTaskWithTriggerInfo(mockTask);

    expect(result.recent_runs).toHaveLength(1);
    expect(result.recent_runs[0].id).toBe("run_xyz");
    expect(result.recent_runs[0].status).toBe("COMPLETED");
    expect(result.recent_runs[0].durationMs).toBe(59000);
    expect(result.upcoming).toEqual(["2026-03-27T09:00:00Z", "2026-04-03T09:00:00Z"]);
    expect(fetchTriggerRuns).toHaveBeenCalledWith({ "filter[schedule]": "sched_abc" }, 5);
  });

  it("returns empty arrays when trigger_schedule_id is null", async () => {
    const taskWithoutSchedule = { ...mockTask, trigger_schedule_id: null };

    const result = await enrichTaskWithTriggerInfo(taskWithoutSchedule);

    expect(result.recent_runs).toEqual([]);
    expect(result.upcoming).toEqual([]);
    expect(fetchTriggerRuns).not.toHaveBeenCalled();
  });

  it("returns empty upcoming when no runs exist", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([] as never);

    const result = await enrichTaskWithTriggerInfo(mockTask);

    expect(result.recent_runs).toEqual([]);
    expect(result.upcoming).toEqual([]);
    expect(retrieveTaskRun).not.toHaveBeenCalled();
  });

  it("returns empty arrays when Trigger.dev API fails", async () => {
    vi.mocked(fetchTriggerRuns).mockRejectedValue(new Error("API error"));

    const result = await enrichTaskWithTriggerInfo(mockTask);

    expect(result.recent_runs).toEqual([]);
    expect(result.upcoming).toEqual([]);
  });

  it("returns runs but empty upcoming when payload has no upcoming", async () => {
    vi.mocked(fetchTriggerRuns).mockResolvedValue([mockRun] as never);
    vi.mocked(retrieveTaskRun).mockResolvedValue({
      ...mockRun,
      payload: {},
    } as never);

    const result = await enrichTaskWithTriggerInfo(mockTask);

    expect(result.recent_runs).toHaveLength(1);
    expect(result.upcoming).toEqual([]);
  });
});
