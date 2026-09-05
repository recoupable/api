import { describe, it, expect, vi, beforeEach } from "vitest";
import { readAutoTopUpSettings } from "@/lib/billing/readAutoTopUpSettings";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({ selectCreditsUsage: vi.fn() }));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("readAutoTopUpSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the account has no credits row", async () => {
    vi.mocked(selectCreditsUsage).mockResolvedValue([]);
    expect(await readAutoTopUpSettings(ACCOUNT)).toBeNull();
    expect(selectCreditsUsage).toHaveBeenCalledWith({ account_id: ACCOUNT });
  });

  it("picks the auto top-up columns off the credits row", async () => {
    vi.mocked(selectCreditsUsage).mockResolvedValue([
      {
        account_id: ACCOUNT,
        remaining_credits: 5,
        auto_topup_enabled: true,
        auto_topup_amount: 100_000_000,
        auto_topup_threshold: 1_000_000,
        auto_topup_last_run_at: null,
        auto_topup_last_error: null,
      } as never,
    ]);
    expect(await readAutoTopUpSettings(ACCOUNT)).toEqual({
      account_id: ACCOUNT,
      auto_topup_enabled: true,
      auto_topup_amount: 100_000_000,
      auto_topup_threshold: 1_000_000,
      auto_topup_last_run_at: null,
      auto_topup_last_error: null,
    });
  });
});
