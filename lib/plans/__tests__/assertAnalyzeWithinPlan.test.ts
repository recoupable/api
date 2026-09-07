import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { countAnalyzedTracksSince } from "@/lib/supabase/usage_events/countAnalyzedTracksSince";
import { getCalendarMonthStart } from "@/lib/plans/getCalendarMonthStart";

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));
vi.mock("@/lib/supabase/usage_events/countAnalyzedTracksSince", () => ({
  countAnalyzedTracksSince: vi.fn(),
}));
vi.mock("@/lib/plans/getCalendarMonthStart", () => ({
  getCalendarMonthStart: vi.fn(() => "2026-09-01T00:00:00.000Z"),
}));

const state = (plan: "free" | "starter" | "pro") => ({ plan, activeSubscription: null }) as never;

describe("assertAnalyzeWithinPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets a free account through under the cap, counting since the month start", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(countAnalyzedTracksSince).mockResolvedValue(4);

    await expect(assertAnalyzeWithinPlan({ accountId: "acc" })).resolves.toBeUndefined();
    expect(getCalendarMonthStart).toHaveBeenCalled();
    expect(countAnalyzedTracksSince).toHaveBeenCalledWith({
      accountId: "acc",
      since: "2026-09-01T00:00:00.000Z",
    });
  });

  it("throws PlanLimitError with the documented body at the cap", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(countAnalyzedTracksSince).mockResolvedValue(5);

    const err = await assertAnalyzeWithinPlan({ accountId: "acc" }).catch(e => e);

    expect(err).toBeInstanceOf(PlanLimitError);
    expect((err as PlanLimitError).body).toMatchObject({
      error: "plan_limit",
      limit: "analyze_count",
      plan: "free",
      analyze_limit: 5,
      current_analyze_count: 5,
    });
    expect((err as PlanLimitError).message).toBe(
      "Free includes 5 tracks analyzed a month. Starter and Pro are unlimited.",
    );
  });

  it.each(["starter", "pro"] as const)("never counts for %s (uncapped)", async plan => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state(plan));

    await expect(assertAnalyzeWithinPlan({ accountId: "acc" })).resolves.toBeUndefined();
    expect(countAnalyzedTracksSince).not.toHaveBeenCalled();
  });
});
