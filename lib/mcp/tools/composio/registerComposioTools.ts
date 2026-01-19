import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getComposioTools } from "@/lib/composio/toolRouter";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/**
 * Registers the "composio" tool on the MCP server.
 *
 * Returns raw Composio Tool Router tools for the given user.
 * Tools are filtered in getComposioTools via ALLOWED_TOOLS constant.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerComposioTools(server: McpServer): void {
  server.registerTool(
    "composio",
    {
      description:
        "Get Composio tools for accessing 500+ external services (Gmail, Sheets, Slack, GitHub, etc). Returns meta-tools for connecting accounts, searching actions, and executing them.",
      inputSchema: z.object({
        account_id: z.string().min(1).describe("User's account ID"),
        room_id: z.string().optional().describe("Chat room ID for OAuth redirect"),
      }),
    },
    async (args) => {
      try {
        const tools = await getComposioTools(args.account_id, args.room_id);
        return getToolResultSuccess(tools);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to get Composio tools"
        );
      }
    }
  );
}
