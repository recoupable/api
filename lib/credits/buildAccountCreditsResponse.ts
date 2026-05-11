import type { CreditsUsage } from "@/lib/supabase/credits_usage/selectCreditsUsage";
import { DEFAULT_CREDITS, PRO_CREDITS } from "@/lib/credits/const";

export interface AccountCreditsResponse {
  account_id: string;
  remaining_credits: number;
  total_credits: number;
  used_credits: number;
  is_pro: boolean;
  timestamp: string | null;
}

/**
 * Shapes a `credits_usage` row + pro flag into the public response documented at
 * `GET /api/accounts/{id}/credits`. Derives `total_credits` from the plan and
 * clamps `used_credits` to a non-negative value when a manual top-up has put the
 * balance above the plan total.
 */
export function buildAccountCreditsResponse(args: {
  creditsUsage: CreditsUsage;
  isPro: boolean;
}): AccountCreditsResponse {
  const { creditsUsage, isPro } = args;
  const total_credits = isPro ? PRO_CREDITS : DEFAULT_CREDITS;
  const used_credits = Math.max(0, total_credits - creditsUsage.remaining_credits);
  return {
    account_id: creditsUsage.account_id,
    remaining_credits: creditsUsage.remaining_credits,
    total_credits,
    used_credits,
    is_pro: isPro,
    timestamp: creditsUsage.timestamp,
  };
}
