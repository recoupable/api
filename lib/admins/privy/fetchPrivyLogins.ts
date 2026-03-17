import { toMs } from "./toMs";
import { fetchPrivyUsersPage } from "./fetchPrivyUsersPage";
import { getLatestVerifiedAt } from "./getLatestVerifiedAt";

export type PrivyLoginsPeriod = "daily" | "weekly" | "monthly";

const PERIOD_DAYS: Record<PrivyLoginsPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

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
export async function fetchPrivyLogins(period: PrivyLoginsPeriod): Promise<Record<string, unknown>[]> {
  const days = PERIOD_DAYS[period];
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const users: Record<string, unknown>[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const page = await fetchPrivyUsersPage(cursor);

    if (!page.data || page.data.length === 0) {
      break;
    }

    for (const user of page.data) {
      const isNew = toMs(user.created_at as number) >= cutoffMs;
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

  users.sort((a, b) => (b.created_at as number) - (a.created_at as number));

  return users;
}
