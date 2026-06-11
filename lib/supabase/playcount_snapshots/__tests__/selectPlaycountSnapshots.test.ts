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
  for (const m of ["select", "eq", "gte", "order"]) builder[m] = vi.fn().mockReturnValue(builder);
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

  it("returns [] on error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuilder({ data: null, error: { message: "boom" } });

    expect(await selectPlaycountSnapshots({})).toEqual([]);
    consoleError.mockRestore();
  });
});
