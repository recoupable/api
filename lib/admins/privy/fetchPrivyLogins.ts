export type PrivyLoginsPeriod = "daily" | "weekly" | "monthly";

const PERIOD_DAYS: Record<PrivyLoginsPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

type PrivyUsersPage = {
  data: Record<string, unknown>[];
  next_cursor?: string;
};

/**
 * Normalizes a Privy timestamp to milliseconds.
 * Privy docs say milliseconds but examples show seconds (10 digits).
 */
function toMs(timestamp: number): number {
  return timestamp > 1e12 ? timestamp : timestamp * 1000;
}

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

  const appId = process.env.PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_PROJECT_SECRET!;
  const authHeader = `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;

  const users: Record<string, unknown>[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const url = new URL("https://api.privy.io/v1/users");
    url.searchParams.set("limit", "100");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "privy-app-id": appId,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Privy API error: ${response.status} ${response.statusText}`);
    }

    const page: PrivyUsersPage = await response.json();

    if (!page.data || page.data.length === 0) {
      break;
    }

    for (const user of page.data) {
      const isNew = toMs(user.created_at as number) >= cutoffMs;
      const isActive =
        typeof user.latest_verified_at === "number" &&
        toMs(user.latest_verified_at) >= cutoffMs;

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

/**
 * Counts how many users in the list were created within the cutoff period.
 */
export function countNewAccounts(users: Record<string, unknown>[], period: PrivyLoginsPeriod): number {
  const cutoffMs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return users.filter((u) => toMs(u.created_at as number) >= cutoffMs).length;
}

/**
 * Counts how many users in the list were active (latest_verified_at) within the cutoff period.
 */
export function countActiveAccounts(users: Record<string, unknown>[], period: PrivyLoginsPeriod): number {
  const cutoffMs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  return users.filter(
    (u) => typeof u.latest_verified_at === "number" && toMs(u.latest_verified_at) >= cutoffMs,
  ).length;
}
