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
 * Fetches Privy users created within the given period via the Privy Management API.
 * Returns the full, unmodified user objects from Privy.
 * Paginates until all users within the time window are retrieved.
 *
 * @see https://docs.privy.io/api-reference/users/get-all
 * @param period - "daily", "weekly", or "monthly"
 * @returns Array of full Privy user objects sorted by created_at descending
 */
export async function fetchPrivyLogins(period: PrivyLoginsPeriod): Promise<Record<string, unknown>[]> {
  const days = PERIOD_DAYS[period];
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffSec = Math.floor(cutoffMs / 1000);

  const appId = process.env.PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_PROJECT_SECRET!;
  const authHeader = `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;

  const users: Record<string, unknown>[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const url = new URL("https://api.privy.io/v1/users");
    url.searchParams.set("limit", "100");
    url.searchParams.set("order", "desc"); // newest first so we can stop early

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

    let reachedCutoff = false;

    for (const user of page.data) {
      if ((user.created_at as number) < cutoffSec) {
        reachedCutoff = true;
        break;
      }

      users.push(user);
    }

    if (reachedCutoff || !page.next_cursor) {
      break;
    }

    cursor = page.next_cursor;
  }

  return users;
}
