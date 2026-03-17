import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";
import { PERIOD_DAYS } from "./periodDays";

/**
 * Returns the cutoff timestamp in milliseconds for a given period.
 * Uses midnight UTC calendar day boundaries to match Privy dashboard behavior.
 * Returns 0 for "all" (no cutoff).
 */
export function getCutoffMs(period: PrivyLoginsPeriod): number {
  if (period === "all") return 0;

  const days = PERIOD_DAYS[period];
  const now = new Date();
  const todayMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return todayMidnightUtc - (days - 1) * 24 * 60 * 60 * 1000;
}
