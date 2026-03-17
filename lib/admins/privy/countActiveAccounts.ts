import { getLatestVerifiedAt } from "./getLatestVerifiedAt";
import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";

const PERIOD_DAYS: Record<PrivyLoginsPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/**
 * Counts how many users in the list were active (latest_verified_at in linked_accounts)
 * within the cutoff period.
 */
export function countActiveAccounts(users: Record<string, unknown>[], period: PrivyLoginsPeriod): number {
  const cutoffMs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return users.filter((u) => {
    const latestVerified = getLatestVerifiedAt(u);
    return latestVerified !== null && latestVerified >= cutoffMs;
  }).length;
}
