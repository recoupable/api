import { getComposioClient } from "@/lib/composio/client";

const LINKEDIN_VERSION = "202609";

export type LinkedInProxyResult = {
  data: Record<string, unknown>;
  headers: Record<string, string>;
};

/**
 * Call LinkedIn's REST API through Composio's proxy, which adds the
 * connection's OAuth token.
 *
 * LinkedIn native video and posting as a Page are not exposed as Composio
 * actions, so they go through the proxy (proven 2026-10-01).
 *
 * @param connectedAccountId - The account's LinkedIn connection.
 * @param method - HTTP method.
 * @param endpoint - Full `https://api.linkedin.com/rest/...` URL.
 * @param body - Optional JSON body.
 * @returns Response data and lower-cased headers.
 */
export async function proxyLinkedIn(
  connectedAccountId: string,
  method: "GET" | "POST",
  endpoint: string,
  body?: Record<string, unknown>,
): Promise<LinkedInProxyResult> {
  const composio = await getComposioClient();
  const response = (await composio.tools.proxyExecute({
    endpoint,
    method,
    connectedAccountId,
    ...(body && { body }),
    parameters: [
      { in: "header", name: "LinkedIn-Version", value: LINKEDIN_VERSION },
      { in: "header", name: "X-Restli-Protocol-Version", value: "2.0.0" },
    ],
  })) as { status: number; data?: unknown; headers?: Record<string, string> };

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `LinkedIn ${method} ${endpoint.split("?")[0]} returned ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`,
    );
  }

  const headers = Object.fromEntries(
    Object.entries(response.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      String(value),
    ]),
  );
  return { data: (response.data ?? {}) as Record<string, unknown>, headers };
}
