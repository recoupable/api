import { toMs } from "./toMs";
import type { PrivyLoginsPeriod } from "./fetchPrivyLogins";
import type { User } from "@privy-io/node";
import { PERIOD_DAYS } from "./periodDays";

/**
 * Counts how many users in the list were created within the cutoff period.
 */
export function countNewAccounts(users: User[], period: PrivyLoginsPeriod): number {
  const cutoffMs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return users.filter((u) => toMs(u.created_at) >= cutoffMs).length;
}
