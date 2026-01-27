import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockEq = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { selectPulseAccounts } from "../selectPulseAccounts";

describe("selectPulseAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ in: mockIn, eq: mockEq });
    mockIn.mockReturnValue({ eq: mockEq });
  });

  it("returns all pulse accounts when accountIds is undefined", async () => {
    const allPulses = [
      { id: "pulse-1", account_id: "account-1", active: true },
      { id: "pulse-2", account_id: "account-2", active: false },
    ];
    mockSelect.mockResolvedValue({ data: allPulses, error: null });

    const result = await selectPulseAccounts({});

    expect(mockFrom).toHaveBeenCalledWith("pulse_accounts");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockIn).not.toHaveBeenCalled();
    expect(result).toEqual(allPulses);
  });

  it("filters by accountIds when provided", async () => {
    const pulses = [{ id: "pulse-1", account_id: "account-1", active: true }];
    mockIn.mockResolvedValue({ data: pulses, error: null });

    const result = await selectPulseAccounts({ accountIds: ["account-1"] });

    expect(mockIn).toHaveBeenCalledWith("account_id", ["account-1"]);
    expect(result).toEqual(pulses);
  });

  it("filters by accountIds with UUID (personal key scenario)", async () => {
    const accountId = "fb678396-a68f-4294-ae50-b8cacf9ce77b";
    const pulses = [{ id: "pulse-uuid-123", account_id: accountId, active: true }];
    mockIn.mockResolvedValue({ data: pulses, error: null });

    const result = await selectPulseAccounts({ accountIds: [accountId] });

    expect(mockFrom).toHaveBeenCalledWith("pulse_accounts");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockIn).toHaveBeenCalledWith("account_id", [accountId]);
    expect(result).toEqual(pulses);
  });

  it("returns empty array when accountIds is empty array", async () => {
    const result = await selectPulseAccounts({ accountIds: [] });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("filters by active status when provided", async () => {
    const activePulses = [{ id: "pulse-1", account_id: "account-1", active: true }];
    mockEq.mockResolvedValue({ data: activePulses, error: null });

    const result = await selectPulseAccounts({ active: true });

    expect(mockEq).toHaveBeenCalledWith("active", true);
    expect(result).toEqual(activePulses);
  });

  it("combines accountIds and active filters", async () => {
    const pulses = [{ id: "pulse-1", account_id: "account-1", active: true }];
    mockEq.mockResolvedValue({ data: pulses, error: null });

    const result = await selectPulseAccounts({
      accountIds: ["account-1", "account-2"],
      active: true,
    });

    expect(mockIn).toHaveBeenCalledWith("account_id", ["account-1", "account-2"]);
    expect(mockEq).toHaveBeenCalledWith("active", true);
    expect(result).toEqual(pulses);
  });

  it("returns empty array on database error", async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { code: "PGRST500", message: "Database error" },
    });

    const result = await selectPulseAccounts({});

    expect(result).toEqual([]);
  });

  it("filters by orgId using join through accounts to account_organization_ids", async () => {
    const mockChainedEq = vi.fn();
    mockSelect.mockReturnValue({ in: mockIn, eq: mockEq });
    mockEq.mockReturnValue({ eq: mockChainedEq });

    const pulses = [
      { id: "pulse-1", account_id: "member-1", active: true, accounts: { account_organization_ids: { organization_id: "org-123" } } },
      { id: "pulse-2", account_id: "member-2", active: false, accounts: { account_organization_ids: { organization_id: "org-123" } } },
    ];
    mockEq.mockResolvedValue({ data: pulses, error: null });

    const result = await selectPulseAccounts({ orgId: "org-123" });

    expect(mockFrom).toHaveBeenCalledWith("pulse_accounts");
    expect(mockSelect).toHaveBeenCalledWith("*, accounts!inner(account_organization_ids!account_organization_ids_account_id_fkey!inner(organization_id))");
    expect(mockEq).toHaveBeenCalledWith("accounts.account_organization_ids.organization_id", "org-123");
    // Result should strip the joined data
    expect(result).toEqual([
      { id: "pulse-1", account_id: "member-1", active: true },
      { id: "pulse-2", account_id: "member-2", active: false },
    ]);
  });

  it("combines orgId and active filters", async () => {
    const mockChainedEq = vi.fn();
    mockEq.mockReturnValue({ eq: mockChainedEq });

    const pulses = [{ id: "pulse-1", account_id: "member-1", active: true, accounts: { account_organization_ids: { organization_id: "org-123" } } }];
    mockChainedEq.mockResolvedValue({ data: pulses, error: null });

    const result = await selectPulseAccounts({ orgId: "org-123", active: true });

    expect(mockSelect).toHaveBeenCalledWith("*, accounts!inner(account_organization_ids!account_organization_ids_account_id_fkey!inner(organization_id))");
    expect(mockEq).toHaveBeenCalledWith("accounts.account_organization_ids.organization_id", "org-123");
    expect(mockChainedEq).toHaveBeenCalledWith("active", true);
    // Result should strip the joined data
    expect(result).toEqual([{ id: "pulse-1", account_id: "member-1", active: true }]);
  });
});
