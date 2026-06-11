import { describe, it, expect, vi, beforeEach } from "vitest";
import { startDueMonthlySnapshots } from "../startDueMonthlySnapshots";

import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { insertPlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/insertPlaycountSnapshot";
import { start } from "workflow/api";

vi.mock("@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots", () => ({
  selectPlaycountSnapshots: vi.fn(),
}));
vi.mock("@/lib/supabase/playcount_snapshots/insertPlaycountSnapshot", () => ({
  insertPlaycountSnapshot: vi.fn(),
}));
vi.mock("workflow/api", () => ({ start: vi.fn() }));
vi.mock("@/app/workflows/playcountSnapshotWorkflow", () => ({
  playcountSnapshotWorkflow: vi.fn(),
}));

const monthly = (id: string, createdAt: string, albumIds: string[]) =>
  ({
    id,
    account: "acc_1",
    album_ids: albumIds,
    platforms: ["spotify"],
    schedule: "monthly",
    state: "done",
    album_count: albumIds.length,
    estimated_cost_usd: 0.003,
    created_at: createdAt,
  }) as never;

describe("startDueMonthlySnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T07:00:00Z"));
    vi.mocked(insertPlaycountSnapshot).mockResolvedValue({ id: "snap_new" } as never);
    vi.mocked(start).mockResolvedValue({ runId: "r" } as never);
  });

  it("re-runs the latest monthly snapshot per series when >30d old", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      monthly("snap_2", "2026-06-09T07:00:00Z", ["a1"]),
      monthly("snap_1", "2026-05-09T07:00:00Z", ["a1"]),
    ]);

    const started = await startDueMonthlySnapshots();

    expect(insertPlaycountSnapshot).toHaveBeenCalledTimes(1);
    expect(insertPlaycountSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ account: "acc_1", album_ids: ["a1"], schedule: "monthly" }),
    );
    expect(started).toBe(1);
  });

  it("does nothing when the latest run is fresh", async () => {
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      monthly("snap_2", "2026-06-25T07:00:00Z", ["a1"]),
    ]);

    expect(await startDueMonthlySnapshots()).toBe(0);
    expect(insertPlaycountSnapshot).not.toHaveBeenCalled();
  });
});
