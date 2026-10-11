import { DEFAULT_CREDITS_USD, PRO_CREDITS_USD, STARTER_CREDITS_USD } from "@/lib/credits/const";
import type { Plan, PlanEntitlements } from "@/lib/plans/types";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/**
 * Tracks a Free account can analyze a month (recoupable/app#2061): a taste of
 * Music Flamingo and a reason to subscribe, sized so five cold single-preset
 * calls cost Recoup well under a dollar of GPU time.
 */
const FREE_ANALYZE_LIMIT = 5;

const ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  free: {
    credits_usd: DEFAULT_CREDITS_USD,
    task_limit: 1,
    min_cadence_minutes: MINUTES_PER_WEEK,
    analyze_limit: FREE_ANALYZE_LIMIT,
  },
  starter: {
    credits_usd: STARTER_CREDITS_USD,
    task_limit: 3,
    min_cadence_minutes: MINUTES_PER_DAY,
    analyze_limit: null,
  },
  pro: {
    credits_usd: PRO_CREDITS_USD,
    task_limit: null,
    min_cadence_minutes: MINUTES_PER_HOUR,
    analyze_limit: null,
  },
};

/**
 * The entitlements table: Free is one weekly task and five analyzed tracks a
 * month, Starter is three daily tasks, Pro is uncapped at an hourly floor (per
 * minute would spend the whole Pro allotment in about 6.5 hours at $0.77 a
 * run); Starter and Pro analyses are uncapped. Credits per plan live in
 * `lib/credits/const.ts` so the marketing page and the ledger agree.
 */
export function getPlanEntitlements(plan: Plan): PlanEntitlements {
  return ENTITLEMENTS[plan];
}
