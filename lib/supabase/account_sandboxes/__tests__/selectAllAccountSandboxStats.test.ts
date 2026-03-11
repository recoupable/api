import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSupabaseFrom = vi.fn();
vi.mock("../../serverClient", () => ({
  default: { from: (...args: unknown[]) => mockSupabaseFrom(...args) },
}));

const { selectAllAccountSandboxStats } = await import("../selectAllAccountSandboxStats");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectAllAccountSandboxStats", () => {
  it("returns empty array when no data", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await selectAllAccountSandboxStats();
    expect(result).toEqual([]);
  });

  it("aggregates rows by account_id with correct counts", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { account_id: "acc-1", created_at: "2026-03-10T12:00:00Z" },
          { account_id: "acc-1", created_at: "2026-03-09T10:00:00Z" },
          { account_id: "acc-2", created_at: "2026-03-08T08:00:00Z" },
        ],
        error: null,
      }),
    });

    const result = await selectAllAccountSandboxStats();

    expect(result).toHaveLength(2);
    const acc1 = result.find(r => r.account_id === "acc-1");
    expect(acc1?.total_sandboxes).toBe(2);
    expect(acc1?.last_created_at).toBe("2026-03-10T12:00:00Z");

    const acc2 = result.find(r => r.account_id === "acc-2");
    expect(acc2?.total_sandboxes).toBe(1);
  });

  it("sorts results by last_created_at descending", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { account_id: "acc-a", created_at: "2026-03-10T12:00:00Z" },
          { account_id: "acc-b", created_at: "2026-03-11T08:00:00Z" },
        ],
        error: null,
      }),
    });

    const result = await selectAllAccountSandboxStats();

    expect(result[0].account_id).toBe("acc-b");
    expect(result[1].account_id).toBe("acc-a");
  });

  it("returns empty array on database error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    });

    const result = await selectAllAccountSandboxStats();
    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});
