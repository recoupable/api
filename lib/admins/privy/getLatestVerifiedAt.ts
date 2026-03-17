import { toMs } from "./toMs";
import type { User } from "@privy-io/node";

/**
 * Returns the most recent latest_verified_at (in ms) across all linked_accounts for a Privy user.
 * Returns null if no linked account has a latest_verified_at.
 */
export function getLatestVerifiedAt(user: User): number | null {
  const linkedAccounts = user.linked_accounts;
  if (!Array.isArray(linkedAccounts)) return null;

  let latest: number | null = null;

  for (const account of linkedAccounts) {
    const verifiedAt = (account as Record<string, unknown>).latest_verified_at;
    if (typeof verifiedAt === "number") {
      const ms = toMs(verifiedAt);
      if (latest === null || ms > latest) {
        latest = ms;
      }
    }
  }

  return latest;
}
