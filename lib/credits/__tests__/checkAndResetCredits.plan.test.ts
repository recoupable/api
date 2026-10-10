import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { refillCreditsToFloor } from "@/lib/supabase/credits_usage/refillCreditsToFloor";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { STARTER_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/credits/initializeAccountCredits", () => ({
  initializeAccountCredits: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({ selectCreditsUsage: vi.fn() }));
vi.mock("@/lib/supabase/credits_usage/refillCreditsToFloor", () => ({
  refillCreditsToFloor: vi.fn(),
}));
vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));

describe("checkAndResetCredits plan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refills a starter account to the STARTER_CREDITS floor and returns plan", async () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const row = {
      account_id: "acc",
      remaining_credits: 5,
      timestamp: twoMonthsAgo.toISOString(),
    } as never;
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(refillCreditsToFloor).mockResolvedValue({
      state: "raised",
      remainingCredits: STARTER_CREDITS,
      timestamp: "2026-05-11T12:00:00",
    });
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      plan: "starter",
      activeSubscription: null,
    });

    const result = await checkAndResetCredits("acc");

    expect(refillCreditsToFloor).toHaveBeenCalledWith({ accountId: "acc", floor: STARTER_CREDITS });
    expect(result).toEqual({
      creditsUsage: {
        ...(row as object),
        remaining_credits: STARTER_CREDITS,
        timestamp: "2026-05-11T12:00:00",
      },
      plan: "starter",
    });
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
