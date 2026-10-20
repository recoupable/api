import { describe, it, expect, vi, beforeEach } from "vitest";

import { checkAndResetCredits } from "@/lib/credits/checkAndResetCredits";
import supabase from "@/lib/supabase/serverClient";
import { selectCreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { refillCreditsToFloor } from "@/lib/supabase/credits_usage/refillCreditsToFloor";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { initializeAccountCredits } from "@/lib/credits/initializeAccountCredits";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

vi.mock("@/lib/supabase/serverClient", () => ({ default: { from: vi.fn(), rpc: vi.fn() } }));

vi.mock("@/lib/supabase/credits_usage/selectCreditsUsage", () => ({
  selectCreditsUsage: vi.fn(),
}));

vi.mock("@/lib/supabase/credits_usage/refillCreditsToFloor", () => ({
  refillCreditsToFloor: vi.fn(),
}));

vi.mock("@/lib/credits/initializeAccountCredits", () => ({
  initializeAccountCredits: vi.fn(),
}));

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174000";
const REFILL_STAMP = "2026-05-11T12:00:00";

const freeState = { plan: "free" as const, activeSubscription: null };
const proStateFromAccount = {
  plan: "pro" as const,
  activeSubscription: {
    id: "sub_1",
    status: "active",
    canceled_at: null,
    current_period_start: Math.floor(new Date("2026-04-15T00:00:00.000Z").getTime() / 1000),
  } as never,
};
const proStateFromOrgNewlySubscribed = {
  plan: "pro" as const,
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
  auto_topup_enabled: false,
  auto_topup_amount: null,
  auto_topup_threshold: null,
  auto_topup_last_run_at: null,
  auto_topup_last_error: null,
  ...overrides,
});

const refillReceipt = (state: "raised" | "unchanged" | "superseded", remainingCredits: number) => ({
  state,
  remainingCredits,
  timestamp: REFILL_STAMP,
});

describe("checkAndResetCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00.000Z"));
  });

  it("seeds the row with the plan allotment when no credits row exists", async () => {
    // An org that has never spent (Seeker) has no row; the read creates it so
    // the billing page and the paid-request gate agree on the balance.
    vi.mocked(selectCreditsUsage).mockResolvedValue([]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);
    const seeded = baseRow({ remaining_credits: DEFAULT_CREDITS, timestamp: null });
    vi.mocked(initializeAccountCredits).mockResolvedValue(seeded);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(initializeAccountCredits).toHaveBeenCalledWith(ACCOUNT);
    expect(result).toEqual({ creditsUsage: seeded, plan: "free" });
    expect(refillCreditsToFloor).not.toHaveBeenCalled();
  });

  it("reads the winner's row when the seed loses a race", async () => {
    const winner = baseRow({ remaining_credits: DEFAULT_CREDITS });
    vi.mocked(selectCreditsUsage).mockResolvedValueOnce([]).mockResolvedValueOnce([winner]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);
    vi.mocked(initializeAccountCredits).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: winner, plan: "free" });
  });

  it("returns null creditsUsage only when the seed and the re-read both fail", async () => {
    vi.mocked(selectCreditsUsage).mockResolvedValue([]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);
    vi.mocked(initializeAccountCredits).mockResolvedValue(null);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: null, plan: "free" });
  });

  it("returns the row unchanged when it has no timestamp (never refilled)", async () => {
    const row = baseRow({ timestamp: null, remaining_credits: 200 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: row, plan: "free" });
    expect(refillCreditsToFloor).not.toHaveBeenCalled();
  });

  it("returns the row unchanged when last refill was within the past month and no new sub", async () => {
    const row = baseRow({ timestamp: "2026-05-01T00:00:00.000Z", remaining_credits: 150 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(result).toEqual({ creditsUsage: row, plan: "free" });
    expect(refillCreditsToFloor).not.toHaveBeenCalled();
  });

  it("refills to DEFAULT_CREDITS when more than a month has passed since the last refill (free tier)", async () => {
    const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 12 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("raised", DEFAULT_CREDITS));
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(refillCreditsToFloor).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      floor: DEFAULT_CREDITS,
      expectedTimestamp: row.timestamp,
    });
    expect(result).toEqual({
      creditsUsage: { ...row, remaining_credits: DEFAULT_CREDITS, timestamp: REFILL_STAMP },
      plan: "free",
    });
  });

  it("refills to PRO_CREDITS when the caller has an active account subscription", async () => {
    const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 12 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("raised", PRO_CREDITS));
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromAccount);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(refillCreditsToFloor).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      floor: PRO_CREDITS,
      expectedTimestamp: row.timestamp,
    });
    expect(result).toEqual({
      creditsUsage: { ...row, remaining_credits: PRO_CREDITS, timestamp: REFILL_STAMP },
      plan: "pro",
    });
  });

  it("refills when an active subscription started AFTER the last credits update (newly subscribed)", async () => {
    const row = baseRow({ timestamp: "2026-05-05T00:00:00.000Z", remaining_credits: 10 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("raised", PRO_CREDITS));
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromOrgNewlySubscribed);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(refillCreditsToFloor).toHaveBeenCalledTimes(1);
    expect(refillCreditsToFloor).toHaveBeenCalledWith({
      accountId: ACCOUNT,
      floor: PRO_CREDITS,
      expectedTimestamp: row.timestamp,
    });
    expect(result.plan).toBe("pro");
    expect(result.creditsUsage).toEqual({
      ...row,
      remaining_credits: PRO_CREDITS,
      timestamp: REFILL_STAMP,
    });
  });

  it("reports plan pro without refilling when sub is active but neither refill trigger fires", async () => {
    const row = baseRow({ timestamp: "2026-05-01T00:00:00.000Z", remaining_credits: 8_000_000 });
    vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromAccount);

    const result = await checkAndResetCredits(ACCOUNT);

    expect(refillCreditsToFloor).not.toHaveBeenCalled();
    expect(result).toEqual({ creditsUsage: row, plan: "pro" });
  });

  describe("the refill is a floor, not an assignment", () => {
    it("sends the plan total as a floor, never an absolute balance", async () => {
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 100 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("raised", DEFAULT_CREDITS));
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      await checkAndResetCredits(ACCOUNT);

      // The database applies GREATEST(remaining, floor) under the row lock. Writing
      // a balance computed from the row read above would resurrect credits a
      // concurrent deduction spent, or drop a top-up that landed in between.
      expect(refillCreditsToFloor).toHaveBeenCalledWith({
        accountId: ACCOUNT,
        floor: DEFAULT_CREDITS,
        expectedTimestamp: row.timestamp,
      });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("raises a balance BELOW the plan total up to it (free tier)", async () => {
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 100 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("raised", DEFAULT_CREDITS));
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(result.creditsUsage?.remaining_credits).toBe(DEFAULT_CREDITS);
      expect(result.creditsUsage?.timestamp).toBe(REFILL_STAMP);
    });

    it("leaves a balance ABOVE the plan total untouched, and still advances the timestamp", async () => {
      const row = baseRow({
        timestamp: "2026-03-01T00:00:00.000Z",
        remaining_credits: PRO_CREDITS,
      });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("unchanged", PRO_CREDITS));
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      // The floor sent is the plan total, not the higher balance read moments earlier.
      expect(refillCreditsToFloor).toHaveBeenCalledWith({
        accountId: ACCOUNT,
        floor: DEFAULT_CREDITS,
        expectedTimestamp: row.timestamp,
      });
      expect(result.creditsUsage?.remaining_credits).toBe(PRO_CREDITS);
      expect(result.creditsUsage?.timestamp).toBe(REFILL_STAMP);
    });

    it("still sends the floor when the balance is exactly the plan total", async () => {
      const row = baseRow({
        timestamp: "2026-03-01T00:00:00.000Z",
        remaining_credits: DEFAULT_CREDITS,
      });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(
        refillReceipt("unchanged", DEFAULT_CREDITS),
      );
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      // The timestamp advances on every due refill, including the no-op ones,
      // otherwise the account re-evaluates as refill-due on every subsequent read.
      expect(refillCreditsToFloor).toHaveBeenCalledWith({
        accountId: ACCOUNT,
        floor: DEFAULT_CREDITS,
        expectedTimestamp: row.timestamp,
      });
      expect(result.creditsUsage?.timestamp).toBe(REFILL_STAMP);
    });

    it("does not cut a pro account holding more than PRO_CREDITS", async () => {
      const row = baseRow({
        timestamp: "2026-03-01T00:00:00.000Z",
        remaining_credits: PRO_CREDITS + 1,
      });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(
        refillReceipt("unchanged", PRO_CREDITS + 1),
      );
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromAccount);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(refillCreditsToFloor).toHaveBeenCalledWith({
        accountId: ACCOUNT,
        floor: PRO_CREDITS,
        expectedTimestamp: row.timestamp,
      });
      expect(result.creditsUsage?.remaining_credits).toBe(PRO_CREDITS + 1);
    });

    it("protects an admin grant on a free account without knowing it is a grant", async () => {
      // 9,999 granted to a free-tier account: no provenance is consulted, the
      // floor rule alone keeps it.
      const row = baseRow({
        timestamp: "2026-03-01T00:00:00.000Z",
        remaining_credits: PRO_CREDITS,
      });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("unchanged", PRO_CREDITS));
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      const [{ floor, expectedTimestamp }] = vi.mocked(refillCreditsToFloor).mock.calls[0];
      expect(floor).toBe(DEFAULT_CREDITS);
      expect(expectedTimestamp).toBe(row.timestamp);
      expect(result.creditsUsage?.remaining_credits).toBe(PRO_CREDITS);
      expect(result.creditsUsage?.remaining_credits).not.toBe(DEFAULT_CREDITS);
    });

    it("treats a newly-subscribed refill as a floor too (does not cut a topped-up balance)", async () => {
      const row = baseRow({
        timestamp: "2026-05-05T00:00:00.000Z",
        remaining_credits: PRO_CREDITS + 2_001_000,
      });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(
        refillReceipt("unchanged", PRO_CREDITS + 2_001_000),
      );
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(proStateFromOrgNewlySubscribed);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(refillCreditsToFloor).toHaveBeenCalledWith({
        accountId: ACCOUNT,
        floor: PRO_CREDITS,
        expectedTimestamp: row.timestamp,
      });
      expect(result.creditsUsage?.remaining_credits).toBe(PRO_CREDITS + 2_001_000);
    });

    it("does not refill twice when another caller already refilled this period", async () => {
      // Two reads of the same stale row both decide a refill is due. The database
      // compares the timestamp each one observed under the row lock, so the second
      // refill is superseded and a debit taken in between is not resurrected.
      const row = baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 12 });
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue({
        state: "superseded",
        remainingCredits: DEFAULT_CREDITS - 200,
        timestamp: "2026-05-11T11:59:58",
      });
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(refillCreditsToFloor).toHaveBeenCalledOnce();
      expect(refillCreditsToFloor).toHaveBeenCalledWith({
        accountId: ACCOUNT,
        floor: DEFAULT_CREDITS,
        expectedTimestamp: "2026-03-01T00:00:00.000Z",
      });
      expect(result.creditsUsage).toEqual({
        ...row,
        remaining_credits: DEFAULT_CREDITS - 200,
        timestamp: "2026-05-11T11:59:58",
      });
    });

    it("keeps the auto-top-up settings from the row it read", async () => {
      const row = {
        ...baseRow({ timestamp: "2026-03-01T00:00:00.000Z", remaining_credits: 12 }),
        auto_topup_enabled: true,
        auto_topup_amount: 500,
        auto_topup_threshold: 50,
      };
      vi.mocked(selectCreditsUsage).mockResolvedValue([row]);
      vi.mocked(refillCreditsToFloor).mockResolvedValue(refillReceipt("raised", DEFAULT_CREDITS));
      vi.mocked(getAccountSubscriptionState).mockResolvedValue(freeState);

      const result = await checkAndResetCredits(ACCOUNT);

      expect(result.creditsUsage).toMatchObject({
        auto_topup_enabled: true,
        auto_topup_amount: 500,
        auto_topup_threshold: 50,
        remaining_credits: DEFAULT_CREDITS,
      });
    });
  });
});
