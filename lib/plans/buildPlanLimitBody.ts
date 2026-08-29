import { CREDIT_BILLING_URL } from "@/lib/credits/const";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { Plan, PlanLimit } from "@/lib/plans/types";

export interface PlanLimitBody {
  status: "error";
  error: "plan_limit";
  limit: PlanLimit;
  message: string;
  plan: Plan;
  task_limit: number | null;
  min_cadence_minutes: number;
  current_task_count: number;
  billingUrl: string;
}

const MESSAGES: Record<PlanLimit, Record<Plan, string>> = {
  task_count: {
    free: "Free includes 1 task. Starter includes 3, Pro is unlimited.",
    starter: "Starter includes 3 tasks. Pro is unlimited.",
    pro: "Pro has no task limit.",
  },
  min_cadence: {
    free: "Free runs tasks weekly at most. Starter runs daily, Pro runs hourly.",
    starter: "Starter runs tasks daily at most. Pro runs hourly.",
    pro: "Pro runs tasks hourly at most.",
  },
};

/**
 * Shapes the 402 `plan_limit` body documented on POST and PATCH /api/tasks.
 * `billingUrl` is the same constant the credits gate returns: retrying
 * creates nothing, so unattended callers are safe to leave running.
 */
export function buildPlanLimitBody(args: {
  plan: Plan;
  limit: PlanLimit;
  currentTaskCount: number;
}): PlanLimitBody {
  const { plan, limit, currentTaskCount } = args;
  const { task_limit, min_cadence_minutes } = getPlanEntitlements(plan);
  return {
    status: "error",
    error: "plan_limit",
    limit,
    message: MESSAGES[limit][plan],
    plan,
    task_limit,
    min_cadence_minutes,
    current_task_count: currentTaskCount,
    billingUrl: CREDIT_BILLING_URL,
  };
}
