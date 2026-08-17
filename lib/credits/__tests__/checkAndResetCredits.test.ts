import { describe, it, expect, vi, beforeEach } from "vitest";

import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { updateCreditsUsage } from "@/lib/supabase/credits_usage/updateCreditsUsage";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/updateCreditsUsage", () => ({
  updateCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";

const freeState = { isPro: false, activeSubscription: null };
const proStateFromAccount = {
  isPro: true,
  activeSubscription: {
    id: "sub_1",
    status: "active",
    canceled_at: null,
    current_period_start: Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000),
  } as never,
};
const proStateFromOrgNewlySubscribed = {
  isPro: true,
  activeSubscription: {
    id: "sub_org",
    status: "active",
    canceled_at: null,
    current_period_start: Math.floor(new Date("2026-05-08T00:00:00.000Z").getTime() / 1000),
  } as never,
};

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
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: null, isPro: false });
    expect(updateCreditsUsage).not.toHaveBeenCalled();
  });

  it("returns the row unchanged when it has no timestamp (never refilled)", async () => {
    const row = baseRow({ timestamp: null, remaining_credits: 200 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: row, isPro: false });
    expect(updateCreditsUsage).not.toHaveBeenCalled();
  });

  it("returns the row unchanged when last refill was within the past month and no new sub", async () => {
    const row = baseRow({ timestamp: "2026-05-01T00:00:00.000Z", remaining_credits: 150 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

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
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

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
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromAccount);

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
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromOrgNewlySubscribed);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(updateCreditsUsage).toHaveBeenCalledTimes(1);
    expect(result.isPro).toBe(true);
    expect(result.creditsUsage).toEqual(refilled);
  });

  it("reports isPro=true without refilling when sub is active but neither refill trigger fires", async () => {
    const row = baseRow({ timestamp: "2026-05-01T00:00:00.000Z", remaining_credits: 800 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromAccount);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(updateCreditsUsage).not.toHaveBeenCalled();
    expect(result).toEqual({ creditsUsage: row, isPro: true });
  });
  // The defect this replaces: the refill SET remaining_credits to the plan
  // total, so a balance above it was cut on the next read. 50 accounts on prod
  // were one balance read away from losing credits.
  describe("the refill is a floor, not an assignment", () => {
    it("raises a balance BELOW the plan total up to it (free tier)", async () => {
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 100 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(updateCreditsUsage).mockResolvedValue({
        ...row,
        remaining_credits: DEFAULT_CREDITS,
        timestamp: "2026-05-11T12:00:00.000Z",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      await checkAndResetCredits(ACCOUNT);

      expect(updateCreditsUsage).toHaveBeenCalledWith({
        account_id: ACCOUNT,
        updates: {
          remaining_credits: DEFAULT_CREDITS,
          timestamp: "2026-05-11T12:00:00.000Z",
        },
      });
    });

    it("leaves a balance ABOVE the plan total untouched, and still advances the timestamp", async () => {
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 9999 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(updateCreditsUsage).mockResolvedValue({
        ...row,
        timestamp: "2026-05-11T12:00:00.000Z",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      // remaining_credits is absent from the update, not set to 9999: a stale
      // read must not resurrect credits a concurrent deduction just spent.
      expect(updateCreditsUsage).toHaveBeenCalledWith({
        account_id: ACCOUNT,
        updates: { timestamp: "2026-05-11T12:00:00.000Z" },
      });
      expect(result.creditsUsage?.remaining_credits).toBe(9999);
    });

    it("writes only the timestamp when the balance is exactly the plan total", async () => {
      const row = baseRow({
        timestamp: "2026-03-01T00:00:00.000Z",
        remaining_credits: DEFAULT_CREDITS,
      });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(updateCreditsUsage).mockResolvedValue({
        ...row,
        timestamp: "2026-05-11T12:00:00.000Z",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      await checkAndResetCredits(ACCOUNT);

      expect(updateCreditsUsage).toHaveBeenCalledWith({
        account_id: ACCOUNT,
        updates: { timestamp: "2026-05-11T12:00:00.000Z" },
      });
    });

    it("does not cut a pro account holding more than PRO_CREDITS", async () => {
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 25000 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(updateCreditsUsage).mockResolvedValue({
        ...row,
        timestamp: "2026-05-11T12:00:00.000Z",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromAccount);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(updateCreditsUsage).toHaveBeenCalledWith({
        account_id: ACCOUNT,
        updates: { timestamp: "2026-05-11T12:00:00.000Z" },
      });
      expect(result.creditsUsage?.remaining_credits).toBe(25000);
    });

    it("protects an admin grant on a free account without knowing it is a grant", async () => {
      // 9,999 granted to a free-tier account: no provenance is consulted, the
      // floor rule alone keeps it.
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 9999 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(updateCreditsUsage).mockResolvedValue({
        ...row,
        timestamp: "2026-05-11T12:00:00.000Z",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      const [{ updates }] = vi.mocked(updateCreditsUsage).mock.calls[0];
      expect(updates).not.toHaveProperty("remaining_credits");
      expect(result.creditsUsage?.remaining_credits).toBe(9999);
      expect(result.creditsUsage?.remaining_credits).not.toBe(DEFAULT_CREDITS);
    });

    it("treats a newly-subscribed refill as a floor too (does not cut a topped-up balance)", async () => {
      const row = baseRow({ timestamp: "2026-05-05T00:00:00.000Z", remaining_credits: 12000 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(updateCreditsUsage).mockResolvedValue({
        ...row,
        timestamp: "2026-05-11T12:00:00.000Z",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromOrgNewlySubscribed);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(updateCreditsUsage).toHaveBeenCalledWith({
        account_id: ACCOUNT,
        updates: { timestamp: "2026-05-11T12:00:00.000Z" },
      });
      expect(result.creditsUsage?.remaining_credits).toBe(12000);
    });
  });
});
