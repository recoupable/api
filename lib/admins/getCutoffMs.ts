import type { AdminPeriod } from "./adminPeriod";
import { PERIOD_DAYS } from "./periodDays";

/**
 * Returns the cutoff timestamp in milliseconds for an admin period, or `null`
 * for `"all"` (no cutoff). Uses midnight-UTC calendar-day boundaries so
 * `daily` means "today since 00:00 UTC", `weekly` means "the last 7 calendar
 * days including today", etc.
 *
 * @param period - The admin period selector.
 * @returns Cutoff timestamp in ms, or null when no cutoff applies.
 */
export function getCutoffMs(period: AdminPeriod): number | null {
  if (period === "all") return null;

  const days = PERIOD_DAYS[period];
  const now = new Date();
  const todayMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return todayMidnightUtc - (days - 1) * 24 * 60 * 60 * 1000;
}
