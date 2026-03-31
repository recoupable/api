import { toMs } from "./toMs";
import type { PrivyLoginsPeriod } from "./privyLoginsPeriod";
import type { User } from "@privy-io/node";
import { getCutoffMs } from "./getCutoffMs";

/**
 * Counts how many users in the list were created within the cutoff period.
 *
 * @param users - Array of Privy user objects to evaluate.
 * @param period - The time window to check against (e.g., "daily", "weekly", "monthly", or "all").
 * @returns The number of users whose created_at timestamp falls within the given period.
 */
export function countNewAccounts(users: User[], period: PrivyLoginsPeriod): number {
  const cutoffMs = getCutoffMs(period);
  return users.filter(u => toMs(u.created_at) >= cutoffMs).length;
}
