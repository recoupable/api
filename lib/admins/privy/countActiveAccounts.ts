import { getLatestVerifiedAt } from "./getLatestVerifiedAt";
import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";
import type { User } from "@privy-io/node/resources/users";
import { PERIOD_DAYS } from "./periodDays";

/**
 * Counts how many users in the list were active (latest_verified_at in linked_accounts)
 * within the cutoff period.
 */
export function countActiveAccounts(users: User[], period: PrivyLoginsPeriod): number {
  const cutoffMs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return users.filter((u) => {
    const latestVerified = getLatestVerifiedAt(u);
    return latestVerified !== null && latestVerified >= cutoffMs;
  }).length;
}
