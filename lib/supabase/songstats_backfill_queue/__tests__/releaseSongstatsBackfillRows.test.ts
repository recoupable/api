import { describe, it, expect, vi, beforeEach } from "vitest";
import { releaseSongstatsBackfillRows } from "../releaseSongstatsBackfillRows";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  return { default: { from: mockFrom } };
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
