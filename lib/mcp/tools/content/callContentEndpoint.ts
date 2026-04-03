import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";

const API_BASE = process.env.RECOUP_API_URL || "https://recoup-api.vercel.app";

/**
 * Proxies a request to a content API endpoint, forwarding the caller's API key.
 * Keeps MCP tools DRY by reusing the existing REST handlers for auth + business logic.
 *
 * @param path - API path starting with "/api/..." (e.g. "/api/content/image").
 * @param method - HTTP method.
 * @param body - JSON body to send (omit for GET).
 * @param authInfo - MCP auth info from the request context.
 * @returns Parsed response data or an error string.
 */
export async function callContentEndpoint(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body: Record<string, unknown> | undefined,
  authInfo: McpAuthInfo | undefined,
): Promise<{ data?: unknown; error?: string }> {
  const { accountId, error } = await resolveAccountId({
    authInfo,
    accountIdOverride: undefined,
  });
  if (error) return { error };
  if (!accountId) return { error: "Authentication required." };

  const apiKey = authInfo?.token;
  if (!apiKey) return { error: "API key required." };

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
  return { data };
}
