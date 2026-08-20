import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectPlaycountSnapshots } from "../selectPlaycountSnapshots";
import supabase from "../../serverClient";

vi.mock("../../serverClient", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { default: { from: mockFrom, rpc: mockRpc } };
});

function mockBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then?: (resolve: (v: unknown) => void) => void;
  } = {} as never;
  for (const m of ["select", "eq", "gte", "order", "limit", "in"])
    builder[m] = vi.fn().mockReturnValue(builder);
  builder.then = resolve => resolve(result);
  vi.mocked(supabase.from).mockReturnValue(builder as never);
  return builder;
}

describe("selectPlaycountSnapshots", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filters by account, created_at lower bound, and schedule", async () => {
    const rows = [{ id: "snap_1", estimated_cost_usd: 1.71 }];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectPlaycountSnapshots({
      account: "acc_1",
      createdAfter: "2026-06-01T00:00:00Z",
      schedule: "monthly",
    });

    expect(supabase.from).toHaveBeenCalledWith("playcount_snapshots");
    expect(builder.eq).toHaveBeenCalledWith("account", "acc_1");
    expect(builder.eq).toHaveBeenCalledWith("schedule", "monthly");
    expect(builder.gte).toHaveBeenCalledWith("created_at", "2026-06-01T00:00:00Z");
    expect(result).toEqual(rows);
  });

  it("filters by catalog", async () => {
    const rows = [{ id: "snap_2", catalog: "cat_1" }];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectPlaycountSnapshots({ catalog: "cat_1" });

    expect(builder.eq).toHaveBeenCalledWith("catalog", "cat_1");
    expect(result).toEqual(rows);
  });

  it("throws on query error so callers never mistake a failure for no rows", async () => {
    mockBuilder({ data: null, error: { message: "boom" } });

    await expect(selectPlaycountSnapshots({})).rejects.toThrow(
      "Failed to fetch playcount_snapshots: boom",
    );
  });

  it("applies limit with a stable id tie-break for limited newest-first reads", async () => {
    const rows = [{ id: "snap_9" }];
    const builder = mockBuilder({ data: rows, error: null });

    const result = await selectPlaycountSnapshots({ account: "acc_1", limit: 3 });

    expect(builder.eq).toHaveBeenCalledWith("account", "acc_1");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(builder.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(3);
    expect(result).toEqual(rows);
  });
});
