interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

const SLACK_API_BASE = "https://slack.com/api";

/**
 * Makes an authenticated GET request to the Slack Web API.
 *
 * @param endpoint - Slack API method name (e.g. "auth.test", "conversations.list")
 * @param token - Slack bot token
 * @param params - Optional query parameters
 * @returns Parsed JSON response
 */
export async function slackGet<T extends SlackApiResponse>(
  endpoint: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${SLACK_API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Slack API ${endpoint} returned HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
