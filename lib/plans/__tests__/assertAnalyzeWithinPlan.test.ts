import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAnalyzeWithinPlan } from "@/lib/plans/assertAnalyzeWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { selectAnalyzedTrackUrlsSince } from "@/lib/supabase/usage_events/selectAnalyzedTrackUrlsSince";
import { getCalendarMonthStart } from "@/lib/plans/getCalendarMonthStart";

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));
vi.mock("@/lib/supabase/usage_events/selectAnalyzedTrackUrlsSince", () => ({
  selectAnalyzedTrackUrlsSince: vi.fn(),
}));
vi.mock("@/lib/plans/getCalendarMonthStart", () => ({
  getCalendarMonthStart: vi.fn(() => "2026-09-01T00:00:00.000Z"),
}));

const state = (plan: "free" | "starter" | "pro") => ({ plan, activeSubscription: null }) as never;

describe("assertAnalyzeWithinPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  const four = ["https://a/1.mp3", "https://a/2.mp3", "https://a/3.mp3", "https://a/4.mp3"];
  const five = [...four, "https://a/5.mp3"];

  it("lets a free account through under the cap, counting since the month start", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(selectAnalyzedTrackUrlsSince).mockResolvedValue(four);

    await expect(
      assertAnalyzeWithinPlan({ accountId: "acc", audioUrl: "https://a/new.mp3" }),
    ).resolves.toBeUndefined();
    expect(getCalendarMonthStart).toHaveBeenCalled();
    expect(selectAnalyzedTrackUrlsSince).toHaveBeenCalledWith({
      accountId: "acc",
      since: "2026-09-01T00:00:00.000Z",
    });
  });

  it("lets a repeat of an already-analyzed track through at the cap", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(selectAnalyzedTrackUrlsSince).mockResolvedValue(five);

    await expect(
      assertAnalyzeWithinPlan({ accountId: "acc", audioUrl: "https://a/3.mp3" }),
    ).resolves.toBeUndefined();
  });

  it("throws PlanLimitError with the documented body for a new track at the cap", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(selectAnalyzedTrackUrlsSince).mockResolvedValue(five);

    const err = await assertAnalyzeWithinPlan({
      accountId: "acc",
      audioUrl: "https://a/6.mp3",
    }).catch(e => e);

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

    await expect(
      assertAnalyzeWithinPlan({ accountId: "acc", audioUrl: "https://a/1.mp3" }),
    ).resolves.toBeUndefined();
    expect(selectAnalyzedTrackUrlsSince).not.toHaveBeenCalled();
  });
});
