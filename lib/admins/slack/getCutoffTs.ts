import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { PERIOD_DAYS } from "@/lib/admins/privy/periodDays";

/**
 * Get Cutoff Ts.
 *
 * @param period - Time range filter.
 * @returns - Computed result.
 */
export function getCutoffTs(period: AdminPeriod): number | null {
  if (period === "all") return null;
  const days = PERIOD_DAYS[period];
  return (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
}
