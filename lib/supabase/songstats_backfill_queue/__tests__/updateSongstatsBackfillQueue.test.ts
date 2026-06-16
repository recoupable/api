import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateSongstatsBackfillQueue,
  reclaimStaleSongstatsBackfillRows,
  releaseSongstatsBackfillRows,
} from "../updateSongstatsBackfillQueue";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

describe("updateSongstatsBackfillQueue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a queue row's status by id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await updateSongstatsBackfillQueue("q1", { status: "done" });

    expect(supabase.from).toHaveBeenCalledWith("songstats_backfill_queue");
    expect(update).toHaveBeenCalledWith({ status: "done" });
    expect(eq).toHaveBeenCalledWith("id", "q1");
  });

  it("throws on update error", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await expect(updateSongstatsBackfillQueue("q1", { status: "failed" })).rejects.toThrow(
      "Failed to update songstats backfill queue: boom",
    );
  });
});

describe("reclaimStaleSongstatsBackfillRows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets failed + AND-grouped stale in_progress rows to pending and returns the count", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const or = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ or });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    const count = await reclaimStaleSongstatsBackfillRows();

    expect(update).toHaveBeenCalledWith({ status: "pending" });
    // The and() grouping around in_progress + updated_at is load-bearing — it is
    // what prevents reclaiming `done`/`pending` rows. Assert the exact structure,
    // not just substrings.
    const orArg = or.mock.calls[0][0] as string;
    expect(orArg).toMatch(/^status\.eq\.failed,and\(status\.eq\.in_progress,updated_at\.lt\..+\)$/);
    expect(count).toBe(2);
  });

  it("throws on a reclaim DB error instead of masking it as 0", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const or = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ update: vi.fn().mockReturnValue({ or }) } as never);

    await expect(reclaimStaleSongstatsBackfillRows()).rejects.toThrow(
      "Failed to reclaim stale songstats backfill rows: boom",
    );
  });
});

describe("releaseSongstatsBackfillRows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets the given ids to pending in one update", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: inFn });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await releaseSongstatsBackfillRows(["q1", "q2"]);

    expect(supabase.from).toHaveBeenCalledWith("songstats_backfill_queue");
    expect(update).toHaveBeenCalledWith({ status: "pending" });
    expect(inFn).toHaveBeenCalledWith("id", ["q1", "q2"]);
  });

  it("is a no-op on an empty list (no DB call)", async () => {
    await releaseSongstatsBackfillRows([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("throws on update error", async () => {
    const inFn = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const update = vi.fn().mockReturnValue({ in: inFn });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await expect(releaseSongstatsBackfillRows(["q1"])).rejects.toThrow(
      "Failed to release songstats backfill rows: boom",
    );
  });
});
