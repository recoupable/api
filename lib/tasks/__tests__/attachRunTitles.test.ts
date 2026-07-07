import { describe, it, expect, vi, beforeEach } from "vitest";

import { attachRunTitles } from "../attachRunTitles";
import { buildRunTitleMap } from "../buildRunTitleMap";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import type { TriggerRun } from "@/lib/trigger/fetchTriggerRuns";
import type { Tables } from "@/types/database.types";

vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

vi.mock("../buildRunTitleMap", () => ({
  buildRunTitleMap: vi.fn(),
}));

const makeRun = (id: string): TriggerRun => ({
  id,
  status: "COMPLETED",
  createdAt: "2026-07-07T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  durationMs: 1000,
});

const mockAction = {
  id: "action_1",
  title: "Weekly valuation + streams report",
  trigger_schedule_id: "sched_1",
} as Tables<"scheduled_actions">;

describe("attachRunTitles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("annotates runs with the resolved title, null when unmapped", async () => {
    vi.mocked(selectScheduledActions).mockResolvedValue([mockAction]);
    vi.mocked(buildRunTitleMap).mockResolvedValue(
      new Map([["run_a", "Weekly valuation + streams report"]]),
    );

    const result = await attachRunTitles([makeRun("run_a"), makeRun("run_b")], "acc_1", 20);

    expect(selectScheduledActions).toHaveBeenCalledWith({ account_id: "acc_1" });
    expect(buildRunTitleMap).toHaveBeenCalledWith([mockAction], 20);
    expect(result[0].title).toBe("Weekly valuation + streams report");
    expect(result[1].title).toBeNull();
  });

  it("preserves all existing run fields", async () => {
    vi.mocked(selectScheduledActions).mockResolvedValue([mockAction]);
    vi.mocked(buildRunTitleMap).mockResolvedValue(new Map());

    const run = { ...makeRun("run_a"), tags: ["account:acc_1"], costInCents: 0.5 };
    const result = await attachRunTitles([run], "acc_1", 20);

    expect(result[0]).toEqual({ ...run, title: null });
  });

  it("returns an empty array without querying when there are no runs", async () => {
    const result = await attachRunTitles([], "acc_1", 20);

    expect(result).toEqual([]);
    expect(selectScheduledActions).not.toHaveBeenCalled();
  });

  it("fails open with null titles when scheduled_actions lookup throws", async () => {
    vi.mocked(selectScheduledActions).mockRejectedValue(new Error("db down"));

    const result = await attachRunTitles([makeRun("run_a")], "acc_1", 20);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("run_a");
    expect(result[0].title).toBeNull();
  });
});
