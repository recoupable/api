import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskRunBlock } from "@/lib/plans/getTaskRunBlock";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { isTaskPlanBlocked } from "@/lib/plans/isTaskPlanBlocked";

vi.mock("@/lib/credits/getAccountSubscriptionState", () => ({
  getAccountSubscriptionState: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/plans/isTaskPlanBlocked", () => ({ isTaskPlanBlocked: vi.fn() }));

const task = { id: "t1", account_id: "acc", enabled: true } as never;

describe("getTaskRunBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAccountSubscriptionState).mockResolvedValue({
      plan: "free",
      isPro: false,
      activeSubscription: null,
    });
    vi.mocked(selectScheduledActions).mockResolvedValue([task, { id: "t2" }] as never);
  });

  it("returns null when nothing blocks the task", async () => {
    vi.mocked(isTaskPlanBlocked).mockReturnValue(null);
    expect(await getTaskRunBlock(task)).toBeNull();
    expect(selectScheduledActions).toHaveBeenCalledWith({ account_id: "acc" });
  });

  it("returns the 402 body with the count excluding the task itself", async () => {
    vi.mocked(isTaskPlanBlocked).mockReturnValue("task_count");
    expect(await getTaskRunBlock(task)).toMatchObject({
      error: "plan_limit",
      limit: "task_count",
      plan: "free",
      current_task_count: 1,
    });
  });

  it("skips the lookups entirely for a disabled task", async () => {
    expect(await getTaskRunBlock({ ...(task as object), enabled: false } as never)).toBeNull();
    expect(getAccountSubscriptionState).not.toHaveBeenCalled();
  });
});
