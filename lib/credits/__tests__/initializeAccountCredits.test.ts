import { beforeEach, describe, expect, it, vi } from "vitest";

import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/supabase/credits_usage/insertCreditsUsage", () => ({
  insertCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

describe("initializeAccountCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds DEFAULT_CREDITS for a free-tier account", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      isPro: false,
      activeSubscription: null,
    });
    const inserted = {
      id: 1,
      account_id: ACCOUNT,
      remaining_credits: DEFAULT_CREDITS,
      timestamp: null,
    };
    vi.mocked(insertCreditsUsage).mockResolvedValue(inserted);

    const result = await initializeAccountCredits(ACCOUNT);

    expect(insertCreditsUsage).toHaveBeenCalledWith(ACCOUNT, DEFAULT_CREDITS);
    expect(result).toEqual(inserted);
  });

  it("seeds PRO_CREDITS when the account already has an active subscription", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      isPro: true,
      activeSubscription: {
        id: "sub_1",
        status: "active",
        canceled_at: null,
      } as never,
    });
    const inserted = {
      id: 2,
      account_id: ACCOUNT,
      remaining_credits: PRO_CREDITS,
      timestamp: null,
    };
    vi.mocked(insertCreditsUsage).mockResolvedValue(inserted);

    const result = await initializeAccountCredits(ACCOUNT);

    expect(insertCreditsUsage).toHaveBeenCalledWith(ACCOUNT, PRO_CREDITS);
    expect(result).toEqual(inserted);
  });

  it("returns null when the underlying insert fails", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      isPro: false,
      activeSubscription: null,
    });
    vi.mocked(insertCreditsUsage).mockResolvedValue(null);

    const result = await initializeAccountCredits(ACCOUNT);

    expect(result).toBeNull();
  });
});
