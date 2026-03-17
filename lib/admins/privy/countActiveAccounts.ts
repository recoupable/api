import { getLatestVerifiedAt } from "./getLatestVerifiedAt";
import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";
import type { User } from "@privy-io/node";
import { getCutoffMs } from "./getCutoffMs";

/**
 * Counts how many users in the list were active (latest_verified_at across all linked_accounts)
 * within the cutoff period.
 */
export function countActiveAccounts(users: User[], period: PrivyLoginsPeriod): number {
  const cutoffMs = getCutoffMs(period);
  return users.filter((u) => {
    const latestVerified = getLatestVerifiedAt(u);
    return latestVerified !== null && latestVerified >= cutoffMs;
  }).length;
}
