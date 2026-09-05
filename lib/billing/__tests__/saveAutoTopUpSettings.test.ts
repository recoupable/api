import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveAutoTopUpSettings } from "@/lib/billing/saveAutoTopUpSettings";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";

vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({ updateCreditsUsage: vi.fn() }));
vi.mock("@/lib/credits/initializeAccountCredits", () => ({ initializeAccountCredits: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const settings = {
  accountId: ACCOUNT,
  enabled: true,
  amountCredits: 50_000_000,
  thresholdCredits: 2_500_000,
};
const row = {
  account_id: ACCOUNT,
  auto_topup_enabled: true,
  auto_topup_amount: 50_000_000,
  auto_topup_threshold: 2_500_000,
  auto_topup_last_run_at: null,
  auto_topup_last_error: null,
} as never;

describe("saveAutoTopUpSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the credits row and clears last_error when enabling", async () => {
    vi.mocked(updateCreditsUsage).mockResolvedValue(row);
    const out = await saveAutoTopUpSettings(settings);
    expect(updateCreditsUsage).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      updates: {
        auto_topup_enabled: true,
        auto_topup_amount: 50_000_000,
        auto_topup_threshold: 2_500_000,
        auto_topup_last_error: null,
      },
    });
    expect(initializeAccountCredits).not.toHaveBeenCalled();
    expect(out?.auto_topup_amount).toBe(50_000_000);
  });

  it("creates the credits row for an account without one, then saves", async () => {
    vi.mocked(updateCreditsUsage)
      .mockRejectedValueOnce(new Error("No credits usage found for account_id: x"))
      .mockResolvedValueOnce(row);
    vi.mocked(initializeAccountCredits).mockResolvedValue(null);
    const out = await saveAutoTopUpSettings({ ...settings, enabled: false });
    expect(initializeAccountCredits).toHaveBeenCalledWith(ACCOUNT);
    expect(updateCreditsUsage).toHaveBeenCalledTimes(2);
    expect(out?.account_id).toBe(ACCOUNT);
  });

  it("rethrows errors that are not the missing-row case", async () => {
    vi.mocked(updateCreditsUsage).mockRejectedValue(new Error("db down"));
    await expect(saveAutoTopUpSettings(settings)).rejects.toThrow("db down");
    expect(initializeAccountCredits).not.toHaveBeenCalled();
  });
});
