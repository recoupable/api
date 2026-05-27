import { describe, it, expect, vi, beforeEach } from "vitest";
import { incrementRemainingCredits } from "@/lib/supabase/credits_usage/incrementRemainingCredits";

const { selectCreditsUsageMock, updateCreditsUsageMock } = vi.hoisted(() => ({
  selectCreditsUsageMock: vi.fn(),
  updateCreditsUsageMock: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: selectCreditsUsageMock,
}));

vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({
  updateCreditsUsage: updateCreditsUsageMock,
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("incrementRemainingCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds the credits to the current balance and returns the updated row", async () => {
    selectCreditsUsageMock.mockResolvedValue([
      {
        account_id: ACCOUNT,
        id: 1,
        remaining_credits: 50,
        timestamp: "2026-05-01T00:00:00Z",
      },
    ]);
    updateCreditsUsageMock.mockResolvedValue({
      account_id: ACCOUNT,
      id: 1,
      remaining_credits: 300,
      timestamp: "2026-05-12T00:00:00Z",
    });

    const result = await incrementRemainingCredits({
      accountId: ACCOUNT,
      delta: 250,
    });

    expect(updateCreditsUsageMock).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      updates: { remaining_credits: 300 },
    });
    expect(result.remaining_credits).toBe(300);
  });

  it("throws when no credits_usage row exists for the account", async () => {
    selectCreditsUsageMock.mockResolvedValue([]);

    await expect(incrementRemainingCredits({ accountId: ACCOUNT, delta: 100 })).rejects.toThrow(
      /No credits usage/,
    );
    expect(updateCreditsUsageMock).not.toHaveBeenCalled();
  });

  it("rejects non-positive delta", async () => {
    await expect(incrementRemainingCredits({ accountId: ACCOUNT, delta: 0 })).rejects.toThrow(
      /positive/,
    );
    await expect(incrementRemainingCredits({ accountId: ACCOUNT, delta: -5 })).rejects.toThrow(
      /positive/,
    );
    expect(selectCreditsUsageMock).not.toHaveBeenCalled();
  });
});
