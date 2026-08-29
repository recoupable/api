import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { buildPlanLimitBody } from "@/lib/plans/buildPlanLimitBody";
import { findTaskPlanViolation } from "@/lib/plans/findTaskPlanViolation";
import { PlanLimitError } from "@/lib/plans/PlanLimitError";

/**
 * The task gate for POST and PATCH /api/tasks and the MCP task tools: resolves
 * the owner's plan and enabled-task count, then throws {@link PlanLimitError}
 * when the request does not fit. Runs before any write so a blocked request
 * creates nothing.
 *
 * @param accountId - The account that owns (or will own) the task.
 * @param schedule - Cron to cadence-check; omit when the schedule is unchanged.
 * @param countsTowardLimit - Whether the task takes a new slot (create, or re-enable).
 * @param excludeTaskId - The task being edited, so it does not count against itself.
 */
export async function assertTaskWithinPlan(args: {
  accountId: string;
  schedule?: string;
  countsTowardLimit?: boolean;
  excludeTaskId?: string;
}): Promise<void> {
  const { accountId, schedule, countsTowardLimit = true, excludeTaskId } = args;
  const [{ plan }, enabledTasks] = await Promise.all([
    getAccountSubscriptionState(accountId),
    selectScheduledActions({ account_id: accountId, enabled: true }),
  ]);
  const enabledTaskCount = enabledTasks.filter(task => task.id !== excludeTaskId).length;

  const limit = findTaskPlanViolation({ plan, enabledTaskCount, schedule, countsTowardLimit });
  if (limit) {
    throw new PlanLimitError(
      buildPlanLimitBody({ plan, limit, currentTaskCount: enabledTaskCount }),
    );
  }
}
