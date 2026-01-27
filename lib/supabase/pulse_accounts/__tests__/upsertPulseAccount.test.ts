import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { upsertPulseAccount } from "../upsertPulseAccount";

describe("upsertPulseAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    mockUpsert.mockReturnValue({ select: mockSelect });
  });

  it("creates new pulse account when none exists", async () => {
    const accountId = "account-123";
    const pulseAccount = {
      id: "pulse-456",
      account_id: accountId,
      active: true,
    };

    mockSelect.mockResolvedValue({ data: [pulseAccount], error: null });

    const result = await upsertPulseAccount({ account_id: accountId, active: true });

    expect(result).toEqual([pulseAccount]);
    expect(mockFrom).toHaveBeenCalledWith("pulse_accounts");
    expect(mockUpsert).toHaveBeenCalledWith(
      { account_id: accountId, active: true },
      { onConflict: "account_id" },
    );
  });

  it("updates existing pulse account when one exists", async () => {
    const accountId = "account-123";
    const pulseAccount = {
      id: "pulse-456",
      account_id: accountId,
      active: false,
    };

    mockSelect.mockResolvedValue({ data: [pulseAccount], error: null });

    const result = await upsertPulseAccount({ account_id: accountId, active: false });

    expect(result).toEqual([pulseAccount]);
    expect(mockUpsert).toHaveBeenCalledWith(
      { account_id: accountId, active: false },
      { onConflict: "account_id" },
    );
  });

  it("returns null on database error", async () => {
    mockSelect.mockResolvedValue({
      data: null,
      error: { code: "PGRST500", message: "Database error" },
    });

    const result = await upsertPulseAccount({ account_id: "account-123", active: true });

    expect(result).toBeNull();
  });
});
