import type { PrivyLoginsPeriod } from "./privyLoginsPeriod";
import { PERIOD_DAYS } from "./periodDays";

/**
 * Get Cutoff Ms.
 *
 * @param period - Parameter.
 * @returns - Result.
 */
export function getCutoffMs(period: PrivyLoginsPeriod): number {
  if (period === "all") return 0;

  const days = PERIOD_DAYS[period];
  const now = new Date();
  const todayMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return todayMidnightUtc - (days - 1) * 24 * 60 * 60 * 1000;
}
