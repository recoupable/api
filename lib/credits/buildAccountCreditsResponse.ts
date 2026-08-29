import type { CreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { usdToCredits } from "@/lib/credits/usdToCredits";
import { getPlanEntitlements } from "@/lib/plans/getPlanEntitlements";
import type { Plan } from "@/lib/plans/types";

export interface AccountCreditsResponse {
  account_id: string;
  remaining_credits: number;
  total_credits: number;
  used_credits: number;
  is_pro: boolean;
  plan: Plan;
  task_limit: number | null;
  min_cadence_minutes: number;
  timestamp: string | null;
}

/**
 * Shapes a `credits_usage` row + plan into the public response documented at
 * `GET /api/accounts/{id}/credits`. Derives `total_credits` and the task
 * entitlements from the plan and
 * clamps `used_credits` to a non-negative value when a manual top-up has put the
 * balance above the plan total.
 */
export function buildAccountCreditsResponse(args: {
  creditsUsage: CreditsUsage;
  plan: Plan;
}): AccountCreditsResponse {
  const { creditsUsage, plan } = args;
  const { credits_usd, task_limit, min_cadence_minutes } = getPlanEntitlements(plan);
  const total_credits = usdToCredits(credits_usd);
  const used_credits = Math.max(0, total_credits - creditsUsage.remaining_credits);
  return {
    account_id: creditsUsage.account_id,
    remaining_credits: creditsUsage.remaining_credits,
    total_credits,
    used_credits,
    is_pro: plan === "pro",
    plan,
    task_limit,
    min_cadence_minutes,
    timestamp: creditsUsage.timestamp,
  };
}
