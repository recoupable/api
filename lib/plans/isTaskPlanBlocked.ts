import type { Tables } from "@/types/database.types";
import { getMinCadenceMinutes } from "@/lib/plans/getMinCadenceMinutes";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { Plan, PlanLimit } from "@/lib/plans/types";

type Task = Pick<Tables<"scheduled_actions">, "id" | "schedule" | "created_at" | "enabled">;

/**
 * Whether an existing task is outside its owner's plan at run time. Over the
 * cap, slots go to the oldest enabled tasks so a downgrade never silently
 * reshuffles which task keeps running.
 */
export function isTaskPlanBlocked(args: {
  task: Task;
  plan: Plan;
  enabledTasks: Task[];
}): PlanLimit | null {
  const { task, plan, enabledTasks } = args;
  if (task.enabled === false) return null;

  const { task_limit, min_cadence_minutes } = getPlanEntitlements(plan);
  const gap = getMinCadenceMinutes(task.schedule);
  if (gap !== null && gap < min_cadence_minutes) return "min_cadence";

  if (task_limit === null) return null;
  const rank = [...enabledTasks]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .findIndex(candidate => candidate.id === task.id);
  return rank >= task_limit ? "task_count" : null;
}
