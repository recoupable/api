import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectAccountSandboxes = vi.fn();
vi.mock("../selectAccountSandboxes", () => ({
  selectAccountSandboxes: (...args: unknown[]) => mockSelectAccountSandboxes(...args),
}));

const { selectAllAccountSandboxStats } = await import("../selectAllAccountSandboxStats");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("selectAllAccountSandboxStats", () => {
  it("calls selectAccountSandboxes with no filters", async () => {
    mockSelectAccountSandboxes.mockResolvedValue([]);

    await selectAllAccountSandboxStats();

    expect(mockSelectAccountSandboxes).toHaveBeenCalledWith({});
  });

  it("returns all rows from selectAccountSandboxes", async () => {
    const rows = [
      { account_id: "acc-1", created_at: "2026-03-10T12:00:00Z", id: "1", sandbox_id: "sbx-1" },
      { account_id: "acc-2", created_at: "2026-03-09T08:00:00Z", id: "2", sandbox_id: "sbx-2" },
    ];
    mockSelectAccountSandboxes.mockResolvedValue(rows);

    const result = await selectAllAccountSandboxStats();

    expect(result).toEqual(rows);
  });
});
