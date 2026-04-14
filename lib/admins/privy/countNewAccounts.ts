import { toMs } from "./toMs";
import type { PrivyLoginsPeriod } from "./privyLoginsPeriod";
import type { User } from "@privy-io/node";
import { getCutoffMs } from "./getCutoffMs";

/**
 * Count New Accounts.
 *
 * @param users - Parameter.
 * @param period - Parameter.
 * @returns - Result.
 */
export function countNewAccounts(users: User[], period: PrivyLoginsPeriod): number {
  const cutoffMs = getCutoffMs(period);
  return users.filter(u => toMs(u.created_at) >= cutoffMs).length;
}
