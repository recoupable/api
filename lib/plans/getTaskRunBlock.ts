import type { Tables } from "@/types/database.types";
import { getAccountSubscriptionState } from "@/lib/credits/getAccountSubscriptionState";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { buildPlanLimitBody, type PlanLimitBody } from "@/lib/plans/buildPlanLimitBody";
import { isTaskPlanBlocked } from "@/lib/plans/isTaskPlanBlocked";

/**
 * The run-path gate: `GET /api/tasks?id=` is what the Trigger.dev runner
 * fetches before every run, so answering 402 here is what skips a task the
 * plan no longer allows. Null means the task may run.
 */
export async function getTaskRunBlock(
  task: Tables<"scheduled_actions">,
): Promise<PlanLimitBody | null> {
  if (task.enabled === false) return null;
  const [{ plan }, enabledTasks] = await Promise.all([
    getAccountSubscriptionState(task.account_id),
    selectScheduledActions({ account_id: task.account_id, enabled: true }),
  ]);
  const limit = isTaskPlanBlocked({ task, plan, enabledTasks });
  if (!limit) return null;
  const currentTaskCount = enabledTasks.filter(candidate => candidate.id !== task.id).length;
  return buildPlanLimitBody({ plan, limit, currentTaskCount });
}
