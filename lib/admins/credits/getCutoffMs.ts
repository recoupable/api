import type { AdminPeriod } from "@/lib/admins/adminPeriod";
import { PERIOD_DAYS } from "@/lib/admins/privy/periodDays";

/**
 * Returns the cutoff timestamp in milliseconds for an admin period, or `null`
 * for `"all"` (no cutoff — caller skips the `created_at >=` filter).
 *
 * Uses midnight-UTC calendar-day boundaries so `daily` means "today since
 * 00:00 UTC", `weekly` means "the last 7 calendar days including today",
 * etc. Matches the convention used by other admin endpoints (privy logins,
 * slack mentions) so the rollup numbers line up with what an admin sees on
 * those dashboards for the same period.
 */
export function getCutoffMs(period: AdminPeriod): number | null {
  if (period === "all") return null;

  const days = PERIOD_DAYS[period];
  const now = new Date();
  const todayMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return todayMidnightUtc - (days - 1) * 24 * 60 * 60 * 1000;
}
