import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getComposioTools } from "@/lib/composio/toolRouter";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/**
 * Schema for the composio tool.
 */
const composioToolSchema = z.object({
  account_id: z
    .string()
    .min(1)
    .describe("The user's account ID (from system prompt)"),
  room_id: z
    .string()
    .optional()
    .describe("The current chat room ID for OAuth redirect (from URL path)"),
});

type ComposioToolArgs = z.infer<typeof composioToolSchema>;

/**
 * Tool description that helps the LLM understand Composio's capabilities.
 */
const COMPOSIO_TOOL_DESCRIPTION = `
Get available Composio tools for accessing 500+ external services.

**GOOGLE SUITE**: Gmail, Google Sheets, Google Drive, Google Docs, Google Calendar
**PRODUCTIVITY**: Slack, Notion, Linear, Jira, Airtable, Trello, Asana
**DEVELOPMENT**: GitHub, GitLab, Bitbucket
**CRM/SALES**: HubSpot, Salesforce, Pipedrive
**COMMUNICATION**: Outlook, Microsoft Teams, Discord, Zoom
**SOCIAL**: Twitter/X, LinkedIn

Returns available tools:
- COMPOSIO_MANAGE_CONNECTIONS - Connect user accounts (OAuth)
- COMPOSIO_SEARCH_TOOLS - Find available actions
- COMPOSIO_GET_TOOL_SCHEMAS - Get parameter schemas
- COMPOSIO_MULTI_EXECUTE_TOOL - Execute actions

IMPORTANT: toolkit names are LOWERCASE (gmail, googlesheets, slack).
`.trim();

/**
 * Registers the "composio" tool on the MCP server.
 *
 * Returns raw tools from Composio's Tool Router for the given user.
 * Tools are filtered to the subset we currently support.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerComposioTools(server: McpServer): void {
  server.registerTool(
    "composio",
    {
      description: COMPOSIO_TOOL_DESCRIPTION,
      inputSchema: composioToolSchema,
    },
    async (args: ComposioToolArgs) => {
      try {
        const tools = await getComposioTools(args.account_id, args.room_id);
        return getToolResultSuccess(tools);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to get Composio tools",
        );
      }
    },
  );
}
