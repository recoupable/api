import type { Tables } from "@/types/database.types";
import { TASK_GATE_GRANDFATHER_UNTIL, TASK_GATE_LAUNCHED_AT } from "@/lib/plans/const";
import { getMinCadenceMinutes } from "@/lib/plans/getMinCadenceMinutes";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { Plan, PlanLimit } from "@/lib/plans/types";

type Task = Pick<Tables<"scheduled_actions">, "id" | "schedule" | "created_at" | "enabled">;

/**
 * Whether an existing task is outside its owner's plan at run time. Pre-gate
 * tasks are exempt until the grandfather date. Over the cap, slots go to the
 * oldest enabled tasks so a downgrade never silently reshuffles which task
 * keeps running.
 */
export function isTaskPlanBlocked(args: {
  task: Task;
  plan: Plan;
  enabledTasks: Task[];
  now: Date;
}): PlanLimit | null {
  const { task, plan, enabledTasks, now } = args;
  if (task.enabled === false) return null;

  const createdAt = task.created_at ? new Date(task.created_at) : now;
  const preGate = createdAt < new Date(TASK_GATE_LAUNCHED_AT);
  if (preGate && now < new Date(TASK_GATE_GRANDFATHER_UNTIL)) return null;

  const { task_limit, min_cadence_minutes } = getPlanEntitlements(plan);
  const gap = getMinCadenceMinutes(task.schedule);
  if (gap !== null && gap < min_cadence_minutes) return "min_cadence";

  if (task_limit === null) return null;
  const rank = [...enabledTasks]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .findIndex(candidate => candidate.id === task.id);
  return rank >= task_limit ? "task_count" : null;
}
