import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertTaskWithinPlan } from "@/lib/plans/assertTaskWithinPlan";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));

const state = (plan: "free" | "starter" | "pro") =>
  ({ plan, isPro: plan === "pro", activeSubscription: null }) as never;

describe("assertTaskWithinPlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts only enabled tasks for the owner, excluding the task being edited", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(selectScheduledActions).mockResolvedValue([{ id: "t1" }] as never);
    await expect(
      assertTaskWithinPlan({ accountId: "acc", schedule: "0 9 * * 1", excludeTaskId: "t1" }),
    ).resolves.toBeUndefined();
    expect(selectScheduledActions).toHaveBeenCalledWith({ account_id: "acc", enabled: true });
  });

  it("throws PlanLimitError carrying the documented body on a second free task", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(selectScheduledActions).mockResolvedValue([{ id: "t1" }] as never);
    const err = await assertTaskWithinPlan({ accountId: "acc", schedule: "0 9 * * 1" }).catch(
      e => e,
    );
    expect(err).toBeInstanceOf(PlanLimitError);
    expect((err as PlanLimitError).body).toMatchObject({
      error: "plan_limit",
      limit: "task_count",
      plan: "free",
      current_task_count: 1,
    });
    expect((err as PlanLimitError).message).toBe(
      "Free includes 1 task. Starter includes 3, Pro is unlimited.",
    );
  });

  it("throws min_cadence for a daily cron on free with no tasks", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("free"));
    vi.mocked(selectScheduledActions).mockResolvedValue([]);
    const err = await assertTaskWithinPlan({ accountId: "acc", schedule: "0 9 * * *" }).catch(
      e => e,
    );
    expect((err as PlanLimitError).body.limit).toBe("min_cadence");
  });

  it("pro passes with many hourly tasks", async () => {
    vi.mocked(getAccountSubscriptionState).mockResolvedValue(state("pro"));
    vi.mocked(selectScheduledActions).mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ id: `t${i}` })) as never,
    );
    await expect(
      assertTaskWithinPlan({ accountId: "acc", schedule: "0 * * * *" }),
    ).resolves.toBeUndefined();
  });
});
