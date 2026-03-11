import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectAccountSandboxes = vi.fn();
vi.mock("@/lib/supabase/account_sandboxes/selectAccountSandboxes", () => ({
  selectAccountSandboxes: (...args: unknown[]) => mockSelectAccountSandboxes(...args),
}));

const { aggregateAccountSandboxStats } = await import("../aggregateAccountSandboxStats");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("aggregateAccountSandboxStats", () => {
  it("calls selectAccountSandboxes with no filters", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([]);

    await aggregateAccountSandboxStats();

    expect(mockSelectAccountSandboxes).toHaveBeenCalledWith({});
  });

  it("returns empty array when no rows", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([]);

    const result = await aggregateAccountSandboxStats();

    expect(result).toEqual([]);
  });

  it("aggregates rows by account_id with correct counts", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([
      { account_id: "acc-1", created_at: "2026-03-10T12:00:00Z", id: "1", sandbox_id: "sbx-1" },
      { account_id: "acc-1", created_at: "2026-03-09T10:00:00Z", id: "2", sandbox_id: "sbx-2" },
      { account_id: "acc-2", created_at: "2026-03-08T08:00:00Z", id: "3", sandbox_id: "sbx-3" },
    ]);

    const result = await aggregateAccountSandboxStats();

    expect(result).toHaveLength(2);
    const acc1 = result.find(r => r.account_id === "acc-1");
    expect(acc1?.total_sandboxes).toBe(2);
    expect(acc1?.last_created_at).toBe("2026-03-10T12:00:00Z");

    const acc2 = result.find(r => r.account_id === "acc-2");
    expect(acc2?.total_sandboxes).toBe(1);
  });

  it("sorts results by last_created_at descending", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([
      { account_id: "acc-a", created_at: "2026-03-10T12:00:00Z", id: "1", sandbox_id: "sbx-1" },
      { account_id: "acc-b", created_at: "2026-03-11T08:00:00Z", id: "2", sandbox_id: "sbx-2" },
    ]);

    const result = await aggregateAccountSandboxStats();

    expect(result[0].account_id).toBe("acc-b");
    expect(result[1].account_id).toBe("acc-a");
  });
});
