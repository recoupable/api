import { toMs } from "./toMs";
import { fetchPrivyUsersPage } from "./fetchPrivyUsersPage";
import { getLatestVerifiedAt } from "./getLatestVerifiedAt";
import { getCutoffMs } from "./getCutoffMs";
import type { User } from "@privy-io/node";
import type { PrivyLoginsPeriod } from "./privyLoginsPeriod";

/**
 * Fetches Privy users active or created within the given period via the Privy Management API.
 * Returns the full, unmodified user objects from Privy.
 * Paginates through all users, collecting those whose created_at or latest_verified_at
 * falls within the time window.
 *
 * @see https://docs.privy.io/api-reference/users/get-all
 * @param period - "daily", "weekly", or "monthly"
 * @returns Array of full Privy user objects within the time window, sorted by created_at descending
 */
export type FetchPrivyLoginsResult = {
  users: User[];
  totalPrivyUsers: number;
};

/**
 * Fetch Privy Logins.
 *
 * @param period - Parameter.
 * @returns - Result.
 */
export async function fetchPrivyLogins(period: PrivyLoginsPeriod): Promise<FetchPrivyLoginsResult> {
  const isAll = period === "all";
  const cutoffMs = getCutoffMs(period);

  const users: User[] = [];
  let totalPrivyUsers = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const page = await fetchPrivyUsersPage(cursor);

    if (!page.data || page.data.length === 0) {
      break;
    }

    totalPrivyUsers += page.data.length;

    for (const user of page.data) {
      const createdAt = user.created_at;
      if (typeof createdAt !== "number" || !Number.isFinite(createdAt)) continue;

      if (isAll) {
        users.push(user);
        continue;
      }

      const isNew = toMs(createdAt) >= cutoffMs;
      const latestVerified = getLatestVerifiedAt(user);
      const isActive = latestVerified !== null && latestVerified >= cutoffMs;

      if (isNew || isActive) {
        users.push(user);
      }
    }

    if (!page.next_cursor) {
      break;
    }

    cursor = page.next_cursor;
  }

  users.sort((a, b) => b.created_at - a.created_at);

  return { users, totalPrivyUsers };
}
