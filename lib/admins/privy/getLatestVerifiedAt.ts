import { toMs } from "./toMs";
import type { User } from "@privy-io/node";

/**
 * Returns the most recent latest_verified_at (in ms) across all linked_accounts for a Privy user.
 * Returns null if no linked account has a latest_verified_at.
 *
 * @param user - The Privy user object whose linked accounts are inspected.
 * @returns The most recent verified-at timestamp in milliseconds, or null if none exists.
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
