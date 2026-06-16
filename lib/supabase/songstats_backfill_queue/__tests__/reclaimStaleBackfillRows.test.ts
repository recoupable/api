import { describe, it, expect, vi, beforeEach } from "vitest";
import { reclaimStaleBackfillRows } from "../reclaimStaleBackfillRows";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => ({ default: { from: vi.fn() } }));

describe("reclaimStaleBackfillRows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resets failed + stale in_progress rows to pending and returns the count", async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [{ id: "a" }, { id: "b" }], error: null });
    const orFn = vi.fn().mockReturnValue({ select: selectFn });
    const updateFn = vi.fn().mockReturnValue({ or: orFn });
    vi.mocked(supabase.from).mockReturnValue({ update: updateFn } as never);

    const count = await reclaimStaleBackfillRows();

    expect(supabase.from).toHaveBeenCalledWith("songstats_backfill_queue");
    expect(updateFn).toHaveBeenCalledWith({ status: "pending" });
    // failed rows OR in_progress rows older than the staleness threshold
    const orArg = orFn.mock.calls[0][0] as string;
    expect(orArg).toContain("status.eq.failed");
    expect(orArg).toContain("status.eq.in_progress");
    expect(orArg).toContain("updated_at.lt.");
    expect(count).toBe(2);
  });

  it("returns 0 and logs on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const selectFn = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const orFn = vi.fn().mockReturnValue({ select: selectFn });
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn().mockReturnValue({ or: orFn }),
    } as never);

    const count = await reclaimStaleBackfillRows();

    expect(count).toBe(0);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
