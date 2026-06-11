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
});
