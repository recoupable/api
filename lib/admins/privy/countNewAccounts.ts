import { toMs } from "./toMs";
import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";

const PERIOD_DAYS: Record<PrivyLoginsPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/**
 * Counts how many users in the list were created within the cutoff period.
 */
export function countNewAccounts(users: Record<string, unknown>[], period: PrivyLoginsPeriod): number {
  const cutoffMs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return users.filter((u) => toMs(u.created_at as number) >= cutoffMs).length;
}
