import { PLAN_BILLING_URL } from "@/lib/credits/const";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { AnalyzePlanLimit, Plan } from "@/lib/plans/types";

export interface AnalyzePlanLimitBody {
  status: "error";
  error: "plan_limit";
  limit: AnalyzePlanLimit;
  message: string;
  plan: Plan;
  analyze_limit: number | null;
  current_analyze_count: number;
  billingUrl: string;
}

/**
 * Shapes the 402 `plan_limit` body documented on POST /api/songs/analyze
 * (`AnalyzePlanLimitError`): the task envelope with the analyze counters in
 * place of the task ones. `billingUrl` points at `/plan`; retrying creates
 * nothing.
 */
export function buildAnalyzePlanLimitBody(args: {
  plan: Plan;
  currentAnalyzeCount: number;
}): AnalyzePlanLimitBody {
  const { plan, currentAnalyzeCount } = args;
  const { analyze_limit } = getPlanEntitlements(plan);
  return {
    status: "error",
    error: "plan_limit",
    limit: "analyze_count",
    message: `Free includes ${analyze_limit} tracks analyzed a month. Starter and Pro are unlimited.`,
    plan,
    analyze_limit,
    current_analyze_count: currentAnalyzeCount,
    billingUrl: PLAN_BILLING_URL,
  };
}
