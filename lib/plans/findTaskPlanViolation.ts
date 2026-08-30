import { getMinCadenceMinutes } from "@/lib/plans/getMinCadenceMinutes";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { Plan, PlanLimit } from "@/lib/plans/types";

/**
 * Decides whether a task request fits the plan. The count check runs first
 * (`enabledTaskCount` excludes the task itself) and only when the task would
 * occupy a slot; the cadence check runs only when a schedule is being set. An
 * unparseable cron is left to schedule validation, not reported as a plan
 * violation.
 */
export function findTaskPlanViolation(args: {
  plan: Plan;
  enabledTaskCount: number;
  schedule?: string;
  countsTowardLimit?: boolean;
}): PlanLimit | null {
  const { plan, enabledTaskCount, schedule, countsTowardLimit = true } = args;
  const { task_limit, min_cadence_minutes } = getPlanEntitlements(plan);

  if (countsTowardLimit && task_limit !== null && enabledTaskCount >= task_limit) {
    return "task_count";
  }
  if (schedule !== undefined) {
    const gap = getMinCadenceMinutes(schedule);
    if (gap !== null && gap < min_cadence_minutes) return "min_cadence";
  }
  return null;
}
