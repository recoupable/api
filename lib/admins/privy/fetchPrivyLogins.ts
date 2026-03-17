export type PrivyLoginRow = {
  privy_did: string;
  email: string | null;
  created_at: string;
};

export type PrivyLoginsPeriod = "daily" | "weekly" | "monthly";

const PERIOD_DAYS: Record<PrivyLoginsPeriod, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

type PrivyUserLinkedAccount = {
  type: string;
  address?: string;
};

type PrivyUser = {
  id: string;
  created_at: number; // Unix timestamp in seconds
  linked_accounts: PrivyUserLinkedAccount[];
};

type PrivyUsersPage = {
  data: PrivyUser[];
  next_cursor?: string;
};

/**
 * Fetches Privy users created within the given period via the Privy Management API.
 * Paginates until all users within the time window are retrieved.
 *
 * @param period - "daily", "weekly", or "monthly"
 * @returns Array of PrivyLoginRow sorted by created_at descending
 */
export async function fetchPrivyLogins(period: PrivyLoginsPeriod): Promise<PrivyLoginRow[]> {
  const days = PERIOD_DAYS[period];
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffSec = Math.floor(cutoffMs / 1000);

  const appId = process.env.PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_PROJECT_SECRET!;
  const authHeader = `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;

  const logins: PrivyLoginRow[] = [];
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
      if (user.created_at < cutoffSec) {
        reachedCutoff = true;
        break;
      }

      const emailAccount = user.linked_accounts?.find((a) => a.type === "email");
      logins.push({
        privy_did: user.id,
        email: emailAccount?.address ?? null,
        created_at: new Date(user.created_at * 1000).toISOString(),
      });
    }

    if (reachedCutoff || !page.next_cursor) {
      break;
    }

    cursor = page.next_cursor;
  }

  return logins;
}
