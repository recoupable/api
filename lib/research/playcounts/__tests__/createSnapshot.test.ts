import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSnapshot } from "../createSnapshot";

import { resolveSnapshotAlbums } from "../resolveSnapshotAlbums";
import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";
import { insertPlaycountSnapshot } from "@/lib/supabase/playcount_snapshots/insertPlaycountSnapshot";
import { start } from "workflow/api";

vi.mock("../resolveSnapshotAlbums", () => ({ resolveSnapshotAlbums: vi.fn() }));
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

describe("createSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SNAPSHOT_MONTHLY_CAP_USD;
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([]);
    vi.mocked(insertPlaycountSnapshot).mockResolvedValue({ id: "snap_1" } as never);
    vi.mocked(start).mockResolvedValue({ runId: "run_1" } as never);
  });

  it("inserts a queued job, starts the workflow, returns 202 payload", async () => {
    vi.mocked(resolveSnapshotAlbums).mockResolvedValue(["a1", "a2"]);

    const result = await createSnapshot({
      accountId: "acc_1",
      body: { album_ids: ["a1", "a2"], platforms: ["spotify"], schedule: "once" },
    });

    expect(insertPlaycountSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acc_1",
        album_ids: ["a1", "a2"],
        platforms: ["spotify"],
        schedule: "once",
        state: "queued",
        album_count: 2,
        estimated_cost_usd: 0.006,
      }),
    );
    expect(start).toHaveBeenCalled();
    expect(result).toEqual({
      data: {
        status: "success",
        snapshot_id: "snap_1",
        state: "queued",
        album_count: 2,
        estimated_cost_usd: 0.006,
      },
    });
  });

  it("400s when nothing resolves to albums", async () => {
    vi.mocked(resolveSnapshotAlbums).mockResolvedValue([]);

    const result = await createSnapshot({
      accountId: "acc_1",
      body: { isrcs: ["UNMAPPED"], platforms: ["spotify"], schedule: "once" },
    });

    expect(result).toEqual({
      error: "No albums resolvable from the given input — no identifier mappings exist yet",
      status: 400,
    });
    expect(insertPlaycountSnapshot).not.toHaveBeenCalled();
  });

  it("429s at the per-org monthly cap", async () => {
    process.env.SNAPSHOT_MONTHLY_CAP_USD = "1";
    vi.mocked(resolveSnapshotAlbums).mockResolvedValue(
      Array.from({ length: 400 }, (_, i) => `a${i}`),
    );
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([{ estimated_cost_usd: 0.9 }] as never);

    const result = await createSnapshot({
      accountId: "acc_1",
      body: { album_ids: ["x"], platforms: ["spotify"], schedule: "once" },
    });

    expect(result).toEqual({
      error: "Per-organization monthly snapshot cap reached",
      status: 429,
    });
    expect(start).not.toHaveBeenCalled();
  });

  // A capture 30 minutes old is reused: play counts do not move meaningfully
  // inside an hour, so re-scraping the same albums is pure waste (chat#1912
  // row 4). This would have failed under the original 15-minute window.
  it("reuses an identical capture from 30 minutes ago instead of scraping again", async () => {
    vi.mocked(resolveSnapshotAlbums).mockResolvedValue(["a1", "a2"]);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      {
        id: "snap_existing",
        album_ids: ["a2", "a1"],
        platforms: ["spotify"],
        schedule: "once",
        state: "done",
        album_count: 2,
        estimated_cost_usd: 0.006,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
    ] as never);

    const result = await createSnapshot({
      accountId: "acc_1",
      body: { album_ids: ["a1", "a2"], platforms: ["spotify"], schedule: "once" },
    });

    expect(result).toEqual({
      data: {
        status: "success",
        snapshot_id: "snap_existing",
        state: "done",
        album_count: 2,
        estimated_cost_usd: 0,
        reused: true,
      },
    });
    expect(insertPlaycountSnapshot).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  // Review finding (coderabbit / cubic, 2026-07-30): the candidate list used to
  // be the monthly-cap query, so in the first hour of a UTC month the previous
  // month's captures were invisible and an identical request re-scraped.
  it("looks back past the month boundary when the reuse window crosses it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:10:00.000Z"));
    vi.mocked(resolveSnapshotAlbums).mockResolvedValue(["a1"]);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([] as never);

    await createSnapshot({
      accountId: "acc_1",
      body: { album_ids: ["a1"], platforms: ["spotify"], schedule: "once" },
    });

    const { createdAfter } = vi.mocked(selectPlaycountSnapshots).mock.calls[0][0];
    // 60 minutes before 00:10 on the 1st is 23:10 on the previous month's last day.
    expect(new Date(createdAfter as string).toISOString()).toBe("2026-07-31T23:10:00.000Z");
    vi.useRealTimers();
  });

  // The cap must still count only the current month, even though the lookup
  // now reaches into the previous one.
  it("excludes previous-month spend from the monthly cap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:10:00.000Z"));
    process.env.SNAPSHOT_MONTHLY_CAP_USD = "1";
    vi.mocked(resolveSnapshotAlbums).mockResolvedValue(["a1"]);
    vi.mocked(selectPlaycountSnapshots).mockResolvedValue([
      {
        id: "last_month",
        album_ids: ["zzz"],
        platforms: ["spotify"],
        schedule: "once",
        state: "done",
        album_count: 1,
        estimated_cost_usd: 5,
        created_at: "2026-07-31T23:50:00.000Z",
      },
    ] as never);

    const result = await createSnapshot({
      accountId: "acc_1",
      body: { album_ids: ["a1"], platforms: ["spotify"], schedule: "once" },
    });

    expect(result).not.toEqual({
      error: "Per-organization monthly snapshot cap reached",
      status: 429,
    });
    vi.useRealTimers();
  });
});
