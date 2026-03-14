import { describe, it, expect, vi, beforeEach } from "vitest";

import { selectAccountSandboxes } from "../selectAccountSandboxes";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("selectAccountSandboxes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn, order: mockOrder });
    mockEq.mockReturnValue({ in: mockIn, order: mockOrder });
    mockIn.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it("returns sandboxes for given accountIds", async () => {
    const mockData = [
      {
        id: "record-1",
        account_id: "account-123",
        sandbox_id: "sbx_abc",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ];
    mockOrder.mockResolvedValue({ data: mockData, error: null });

    const result = await selectAccountSandboxes({
      accountIds: ["account-123"],
    });

    expect(mockFrom).toHaveBeenCalledWith("account_sandboxes");
    expect(mockIn).toHaveBeenCalledWith("account_id", ["account-123"]);
    expect(result).toEqual(mockData);
  });

  it("filters by sandbox_id when provided", async () => {
    const mockData = [
      {
        id: "record-1",
        account_id: "account-123",
        sandbox_id: "sbx_specific",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ];
    mockEq.mockReturnValue({ in: mockIn, order: mockOrder });
    mockOrder.mockResolvedValue({ data: mockData, error: null });

    const result = await selectAccountSandboxes({
      accountIds: ["account-123"],
      sandboxId: "sbx_specific",
    });

    expect(mockEq).toHaveBeenCalledWith("sandbox_id", "sbx_specific");
    expect(result).toEqual(mockData);
  });

  it("returns empty array when no sandboxes found", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await selectAccountSandboxes({
      accountIds: ["account-123"],
    });

    expect(result).toEqual([]);
  });

  it("returns empty array on database error", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "Database error", code: "500" },
    });

    const result = await selectAccountSandboxes({
      accountIds: ["account-123"],
    });

    expect(result).toEqual([]);
  });

  it("queries org accounts when orgId is provided", async () => {
    const mockOrgAccounts = [{ account_id: "org-account-1" }, { account_id: "org-account-2" }];
    const mockSandboxes = [
      {
        id: "record-1",
        account_id: "org-account-1",
        sandbox_id: "sbx_org",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ];

    // Mock the org accounts query
    const mockOrgSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: mockOrgAccounts, error: null }),
    });

    // First call is for account_sandboxes, second is for account_organization_ids
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "account_organization_ids") {
        return { select: mockOrgSelect };
      }
      callCount++;
      return { select: mockSelect };
    });

    mockOrder.mockResolvedValue({ data: mockSandboxes, error: null });

    const result = await selectAccountSandboxes({
      orgId: "org-123",
    });

    expect(mockFrom).toHaveBeenCalledWith("account_organization_ids");
    expect(mockIn).toHaveBeenCalledWith("account_id", ["org-account-1", "org-account-2"]);
    expect(result).toEqual(mockSandboxes);
  });

  it("returns empty array when org has no accounts", async () => {
    const mockOrgSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "account_organization_ids") {
        return { select: mockOrgSelect };
      }
      return { select: mockSelect };
    });

    const result = await selectAccountSandboxes({
      orgId: "org-empty",
    });

    expect(result).toEqual([]);
  });
});
