import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectSongstatsQuotaSpent } from "../selectSongstatsQuotaSpent";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

describe("selectSongstatsQuotaSpent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums hits spent since the window start", async () => {
    const gte = vi.fn().mockResolvedValue({ data: [{ hits: 3 }, { hits: 7 }], error: null });
    const select = vi.fn().mockReturnValue({ gte });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const result = await selectSongstatsQuotaSpent("2026-05-12T00:00:00Z");

    expect(supabase.from).toHaveBeenCalledWith("songstats_quota_ledger");
    expect(gte).toHaveBeenCalledWith("spent_at", "2026-05-12T00:00:00Z");
    expect(result).toBe(10);
  });

  it("treats errors as full quota spent (fail safe — do not overspend)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const gte = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const select = vi.fn().mockReturnValue({ gte });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    expect(await selectSongstatsQuotaSpent("2026-05-12T00:00:00Z")).toBe(Number.MAX_SAFE_INTEGER);
    consoleError.mockRestore();
  });
});
