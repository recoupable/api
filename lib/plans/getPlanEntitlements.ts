import { DEFAULT_CREDITS_USD, PRO_CREDITS_USD, STARTER_CREDITS_USD } from "@/lib/credits/const";
import type { Plan, PlanEntitlements } from "@/lib/plans/types";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

const ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  free: { credits_usd: DEFAULT_CREDITS_USD, task_limit: 1, min_cadence_minutes: MINUTES_PER_WEEK },
  starter: {
    credits_usd: STARTER_CREDITS_USD,
    task_limit: 3,
    min_cadence_minutes: MINUTES_PER_DAY,
  },
  pro: { credits_usd: PRO_CREDITS_USD, task_limit: null, min_cadence_minutes: MINUTES_PER_HOUR },
};

/**
 * The entitlements table: Free is one weekly task, Starter is three daily
 * tasks, Pro is uncapped at an hourly floor (per minute would spend the whole
 * Pro allotment in about 6.5 hours at $0.77 a run). Credits per plan live in
 * `lib/credits/const.ts` so the marketing page and the ledger agree.
 */
export function getPlanEntitlements(plan: Plan): PlanEntitlements {
  return ENTITLEMENTS[plan];
}
