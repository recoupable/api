import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { STARTER_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({ selectCreditsUsage: vi.fn() }));
vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({ updateCreditsUsage: vi.fn() }));
vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));

describe("checkAndResetCredits plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refills a starter account to STARTER_CREDITS and returns plan", async () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const row = {
      account_id: "acc",
      remaining_credits: 5,
      timestamp: twoMonthsAgo.toISOString(),
    } as never;
    const refilled = { ...(row as object), remaining_credits: STARTER_CREDITS } as never;
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(updateCreditsUsage).mockResolvedValue(refilled);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      plan: "starter",
      activeSubscription: null,
    });

    const result = await checkAndResetCredits("acc");

    expect(vi.mocked(updateCreditsUsage).mock.calls[0][0].updates.remaining_credits).toBe(
      STARTER_CREDITS,
    );
    expect(result).toEqual({ creditsUsage: refilled, plan: "starter" });
  });

  it("returns plan free with no row", async () => {
    vi.mocked(selectCreditsUsage).mockResolvedValue([]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      plan: "free",
      activeSubscription: null,
    });
    expect(await checkAndResetCredits("acc")).toEqual({
      creditsUsage: null,
      plan: "free",
    });
  });
});
