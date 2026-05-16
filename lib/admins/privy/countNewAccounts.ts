import { toMs } from "./toMs";
import type { PrivyLoginsPeriod } from "./privyLoginsPeriod";
import type { User } from "@privy-io/node";
import { getCutoffMs } from "@/lib/admins/getCutoffMs";

/**
 * Counts how many users in the list were created within the cutoff period.
 */
export function countNewAccounts(users: User[], period: PrivyLoginsPeriod): number {
  const cutoffMs = getCutoffMs(period);
  if (cutoffMs === null) return users.length;
  return users.filter(u => toMs(u.created_at) >= cutoffMs).length;
}
