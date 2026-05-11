import { describe, it, expect, vi, beforeEach } from "vitest";

import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { getActiveSubscriptionDetails } from "@/lib/stripe/getActiveSubscriptionDetails";
import { getOrgSubscription } from "@/lib/stripe/getOrgSubscription";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({
  updateCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/stripe/getActiveSubscriptionDetails", () => ({
  getActiveSubscriptionDetails: vi.fn(),
}));

vi.mock("@/lib/stripe/getOrgSubscription", () => ({
  getOrgSubscription: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const baseRow = (
  overrides: Partial<{ remaining_credits: number; timestamp: string | null }> = {},
) => ({
  id: 1,
  account_id: ACCOUNT,
  remaining_credits: 100,
  timestamp: "2026-05-01T00:00:00.000Z",
  ...overrides,
});

describe("checkAndResetCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"));
  });

  it("returns { creditsUsage: null, isPro: false } when no credits row exists", async () => {
    vi.mocked(selectCreditsUsage).mockResolvedValue([]);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: null, isPro: false });
    expect(updateCreditsUsage).not.toHaveBeenCalled();
  });

  it("returns the row unchanged when it has no timestamp (never refilled)", async () => {
    const row = baseRow({ timestamp: null, remaining_credits: 200 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: row, isPro: false });
    expect(updateCreditsUsage).not.toHaveBeenCalled();
  });

  it("returns the row unchanged when last refill was within the past month and no new sub", async () => {
    const row = baseRow({ timestamp: "2026-05-01T00:00:00.000Z", remaining_credits: 150 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: row, isPro: false });
    expect(updateCreditsUsage).not.toHaveBeenCalled();
  });

  it("refills to DEFAULT_CREDITS when more than a month has passed since the last refill (free tier)", async () => {
    const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 12 });
    const refilled = {
      ...row,
      remaining_credits: DEFAULT_CREDITS,
      timestamp: "2026-05-11T12:00:00.000Z",
    };
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(updateCreditsUsage).mockResolvedValue(refilled);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(updateCreditsUsage).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      updates: {
        remaining_credits: DEFAULT_CREDITS,
        timestamp: "2026-05-11T12:00:00.000Z",
      },
    });
    expect(result).toEqual({ creditsUsage: refilled, isPro: false });
  });

  it("refills to PRO_CREDITS when the caller has an active account subscription", async () => {
    const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 12 });
    const refilled = {
      ...row,
      remaining_credits: PRO_CREDITS,
      timestamp: "2026-05-11T12:00:00.000Z",
    };
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(updateCreditsUsage).mockResolvedValue(refilled);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
      id: "sub_1",
      status: "active",
      canceled_at: null,
      current_period_start: Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000),
    } as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(updateCreditsUsage).toHaveBeenCalledWith({
      account_id: ACCOUNT,
      updates: {
        remaining_credits: PRO_CREDITS,
        timestamp: "2026-05-11T12:00:00.000Z",
      },
    });
    expect(result).toEqual({ creditsUsage: refilled, isPro: true });
  });

  it("refills when an active subscription started AFTER the last credits update (newly subscribed)", async () => {
    const row = baseRow({ timestamp: "2026-05-05T00:00:00.000Z", remaining_credits: 10 });
    const refilled = {
      ...row,
      remaining_credits: PRO_CREDITS,
      timestamp: "2026-05-11T12:00:00.000Z",
    };
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(updateCreditsUsage).mockResolvedValue(refilled);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue(null);
    vi.mocked(getOrgSubscription).mockResolvedValue({
      id: "sub_org",
      status: "active",
      canceled_at: null,
      current_period_start: Math.floor(new Date("2026-05-08T00:00:00.000Z").getTime() / 1000),
    } as never);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(updateCreditsUsage).toHaveBeenCalledTimes(1);
    expect(result.isPro).toBe(true);
    expect(result.creditsUsage).toEqual(refilled);
  });

  it("reports isPro=true without refilling when sub is active but neither refill trigger fires", async () => {
    const row = baseRow({ timestamp: "2026-05-01T00:00:00.000Z", remaining_credits: 800 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getActiveSubscriptionDetails).mockResolvedValue({
      id: "sub_1",
      status: "active",
      canceled_at: null,
      current_period_start: Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000),
    } as never);
    vi.mocked(getOrgSubscription).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(updateCreditsUsage).not.toHaveBeenCalled();
    expect(result).toEqual({ creditsUsage: row, isPro: true });
  });
});
