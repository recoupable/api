import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { selectPulseAccount } from "../selectPulseAccount";

describe("selectPulseAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("returns pulse account when found", async () => {
    const accountId = "account-123";
    const pulseAccount = {
      id: "pulse-456",
      account_id: accountId,
      active: true,
    };

    mockSingle.mockResolvedValue({ data: pulseAccount, error: null });

    const result = await selectPulseAccount(accountId);

    expect(result).toEqual(pulseAccount);
    expect(mockFrom).toHaveBeenCalledWith("pulse_accounts");
    expect(mockSelect).toHaveBeenCalledWith("*");
    expect(mockEq).toHaveBeenCalledWith("account_id", accountId);
  });

  it("returns null when no record found (PGRST116)", async () => {
    const accountId = "account-123";

    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows returned" },
    });

    const result = await selectPulseAccount(accountId);

    expect(result).toBeNull();
  });

  it("returns null on other database errors", async () => {
    const accountId = "account-123";

    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST500", message: "Database error" },
    });

    const result = await selectPulseAccount(accountId);

    expect(result).toBeNull();
  });
});
