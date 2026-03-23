import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { PERIOD_DAYS } from "@/lib/admins/privy/periodDays";

/**
 * Returns the cutoff timestamp in seconds for a given period, or null for "all".
 * Used by the Slack API which expects timestamps in seconds.
 *
 * @param period
 */
export function getCutoffTs(period: AdminPeriod): number | null {
  if (period === "all") return null;
  const days = PERIOD_DAYS[period];
  return (Date.now() - days * 24 * 60 * 60 * 1000) / 1000;
}
