import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertPlaycountSnapshot } from "../insertPlaycountSnapshot";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

describe("insertPlaycountSnapshot", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts a snapshot job row and returns it", async () => {
    const row = { id: "snap_1", account: "acc_1", state: "queued" };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    const result = await insertPlaycountSnapshot({
      account: "acc_1",
      album_ids: ["a1"],
      platforms: ["spotify"],
      album_count: 1,
      estimated_cost_usd: 0.003,
    } as never);

    expect(supabase.from).toHaveBeenCalledWith("playcount_snapshots");
    expect(insert).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it("throws on insert error", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    await expect(insertPlaycountSnapshot({ account: "a" } as never)).rejects.toThrow(
      "Failed to insert playcount snapshot: boom",
    );
  });
});
