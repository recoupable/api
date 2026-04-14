import { toMs } from "./toMs";
import type { User } from "@privy-io/node";

/**
 * Get Latest Verified At.
 *
 * @param user - Parameter.
 * @returns - Result.
 */
export function getLatestVerifiedAt(user: User): number | null {
  const linkedAccounts = user.linked_accounts;
  if (!Array.isArray(linkedAccounts)) return null;

  let latest: number | null = null;

  for (const account of linkedAccounts) {
    if ("latest_verified_at" in account && typeof account.latest_verified_at === "number") {
      const ms = toMs(account.latest_verified_at);
      if (latest === null || ms > latest) {
        latest = ms;
      }
    }
  }

  return latest;
}
