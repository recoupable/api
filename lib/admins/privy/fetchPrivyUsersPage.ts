type PrivyUsersPage = {
  data: Record<string, unknown>[];
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
  const appId = process.env.PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_PROJECT_SECRET!;
  const authHeader = `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;

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

  return response.json();
}
