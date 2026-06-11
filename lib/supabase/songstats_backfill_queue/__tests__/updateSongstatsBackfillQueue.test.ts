import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSongstatsBackfillQueue } from "../updateSongstatsBackfillQueue";
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
