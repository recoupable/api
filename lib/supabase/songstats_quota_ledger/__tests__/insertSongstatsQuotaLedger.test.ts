import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertSongstatsQuotaLedger } from "../insertSongstatsQuotaLedger";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

describe("insertSongstatsQuotaLedger", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records spent hits", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await insertSongstatsQuotaLedger({ hits: 1, purpose: "backfill USA2P2015959" });

    expect(supabase.from).toHaveBeenCalledWith("songstats_quota_ledger");
    expect(insert).toHaveBeenCalledWith([{ hits: 1, purpose: "backfill USA2P2015959" }]);
  });

  it("throws on insert error (spend must be recorded)", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await expect(insertSongstatsQuotaLedger({ hits: 1 })).rejects.toThrow(
      "Failed to record songstats quota spend: boom",
    );
  });
});
