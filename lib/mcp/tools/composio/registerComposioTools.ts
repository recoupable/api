import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getComposioTools } from "@/lib/composio/toolRouter";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

/**
 * Schema for the composio meta-tool.
 *
 * Since Tool Router tools require a userId to create a session,
 * we wrap all Composio tools in a single MCP tool that accepts
 * account_id and routes to the appropriate Composio tool.
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
  tool_name: z
    .string()
    .min(1)
    .describe(
      "The Composio tool to use. Options: COMPOSIO_SEARCH_TOOLS, COMPOSIO_MANAGE_CONNECTIONS, COMPOSIO_GET_TOOL_SCHEMAS, COMPOSIO_MULTI_EXECUTE_TOOL",
    ),
  tool_params: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Parameters for the Composio tool. " +
        "For COMPOSIO_MANAGE_CONNECTIONS: {toolkits: ['googlesheets']} (lowercase). " +
        "For COMPOSIO_SEARCH_TOOLS: {queries: [{query: 'read google sheets'}]}. " +
        "For COMPOSIO_MULTI_EXECUTE_TOOL: {tool_calls: [{tool_slug: 'TOOL_NAME', parameters: {...}}]}.",
    ),
});

type ComposioToolArgs = z.infer<typeof composioToolSchema>;

/**
 * Tool description that helps the LLM understand Composio's capabilities.
 * Includes categories of available services and usage patterns.
 */
const COMPOSIO_TOOL_DESCRIPTION = `
Access 500+ external services via Composio. Use this when the user wants to interact with:

**GOOGLE SUITE**: Gmail (read/send emails), Google Sheets (create/read/update spreadsheets), Google Drive (files), Google Docs, Google Calendar (events)
**PRODUCTIVITY**: Slack (messages), Notion (pages/databases), Linear (issues), Jira, Airtable, Trello, Asana
**DEVELOPMENT**: GitHub (repos/issues/PRs), GitLab, Bitbucket
**CRM/SALES**: HubSpot, Salesforce, Pipedrive
**COMMUNICATION**: Outlook, Microsoft Teams, Discord, Zoom
**SOCIAL**: Twitter/X (posts), LinkedIn

HOW TO USE:
1. First, CONNECT the user's account: tool_name='COMPOSIO_MANAGE_CONNECTIONS', tool_params={"toolkits":["gmail"]}
2. Search for specific actions: tool_name='COMPOSIO_SEARCH_TOOLS', tool_params={"queries":[{"query":"read emails"}]}
3. Execute actions: tool_name='COMPOSIO_MULTI_EXECUTE_TOOL', tool_params={"tool_calls":[{"tool_slug":"GMAIL_LIST_EMAILS","parameters":{}}]}

EXAMPLES:
- Read emails: Connect 'gmail', then use GMAIL_LIST_EMAILS or GMAIL_GET_EMAIL
- Create spreadsheet: Connect 'googlesheets', then use GOOGLESHEETS_CREATE
- Send Slack message: Connect 'slack', then use SLACK_POST_MESSAGE
- Create GitHub issue: Connect 'github', then use GITHUB_CREATE_ISSUE

IMPORTANT: toolkit names are LOWERCASE (gmail, googlesheets, slack). Always include account_id and room_id.
`.trim();

/**
 * Registers the "composio" tool on the MCP server.
 *
 * This is a meta-tool that provides access to Composio's Tool Router,
 * which enables Google Sheets, Google Drive, and 500+ other connectors.
 *
 * The AI should:
 * 1. Use COMPOSIO_SEARCH_TOOLS to find available actions
 * 2. Use COMPOSIO_MANAGE_CONNECTIONS if authentication is needed
 * 3. Use COMPOSIO_MULTI_EXECUTE_TOOL to run actions
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
        const tool = tools[args.tool_name];

        if (!tool) {
          const availableTools = Object.keys(tools);
          return getToolResultError(
            `Tool "${args.tool_name}" not found. Available tools: ${availableTools.join(", ")}`,
          );
        }

        const result = await tool.execute(args.tool_params || {});
        return getToolResultSuccess(result);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Composio tool execution failed",
        );
      }
    },
  );
}
