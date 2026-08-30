import { beforeEach, describe, expect, it, vi } from "vitest";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { insertCreditsUsage } from "@/lib/supabase/credits_usage/insertCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { STARTER_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/supabase/credits_usage/insertCreditsUsage", () => ({ insertCreditsUsage: vi.fn() }));
vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));

describe("initializeAccountCredits starter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seeds STARTER_CREDITS for a starter account", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      plan: "starter",
      activeSubscription: null,
    });
    vi.mocked(insertCreditsUsage).mockResolvedValue(null);
    await initializeAccountCredits("acc");
    expect(insertCreditsUsage).toHaveBeenCalledWith("acc", STARTER_CREDITS);
  });
});
