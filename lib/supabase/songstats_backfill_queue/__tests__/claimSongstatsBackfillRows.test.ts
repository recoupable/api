import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimSongstatsBackfillRows } from "../claimSongstatsBackfillRows";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

describe("claimSongstatsBackfillRows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims a batch via the FOR UPDATE SKIP LOCKED rpc", async () => {
    const rows = [{ id: "q1", song: "USA2P2015959", status: "in_progress" }];
    vi.mocked(supabase.rpc).mockResolvedValue({ data: rows, error: null } as never);

    const result = await claimSongstatsBackfillRows(25);

    expect(supabase.rpc).toHaveBeenCalledWith("claim_songstats_backfill_rows", {
      batch_size: 25,
    });
    expect(result).toEqual(rows);
  });

  it("returns [] on rpc error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "boom" } } as never);

    expect(await claimSongstatsBackfillRows(5)).toEqual([]);
    consoleError.mockRestore();
  });
});
