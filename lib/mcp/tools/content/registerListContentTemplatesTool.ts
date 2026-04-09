import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const inputSchema = z.object({});

/**
 * Registers the "list_content_templates" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerListContentTemplatesTool(server: McpServer): void {
  server.registerTool(
    "list_content_templates",
    {
      description:
        "List all available content creation templates. " +
        "Templates are optional shortcuts — curated creative recipes that pre-fill parameters.",
      inputSchema,
    },
    async (
      _args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error: authError } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (authError) return getToolResultError(authError);
      if (!accountId) return getToolResultError("Authentication required.");

      const apiKey = authInfo?.token;
      if (!apiKey) return getToolResultError("API key required.");

      const API_BASE = process.env.RECOUP_API_URL || "https://recoup-api.vercel.app";
      const response = await fetch(`${API_BASE}/api/content/templates`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      });

      const data = await response.json();
      if (!response.ok)
        return getToolResultError(data.error || `Request failed: ${response.status}`);
      return getToolResultSuccess(data);
    },
  );
}
