import type { User } from "@privy-io/node";

export type PrivyUsersPage = {
  data: User[];
  next_cursor?: string;
};

/**
 * Fetches a single page of users from the Privy Management API.
 *
 * @see https://docs.privy.io/api-reference/users/get-all
 * @param cursor - Pagination cursor for the next page
 * @returns A page of Privy user objects with an optional next_cursor
 */
export async function fetchPrivyUsersPage(cursor?: string): Promise<PrivyUsersPage> {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_PROJECT_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Missing Privy credentials: PRIVY_APP_ID/PRIVY_PROJECT_SECRET");
  }
  const authHeader = `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;

  const url = new URL("https://api.privy.io/v1/users");
  url.searchParams.set("limit", "100");

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "privy-app-id": appId,
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Privy API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
