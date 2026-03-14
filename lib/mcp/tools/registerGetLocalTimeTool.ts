import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLocalTime } from "@/lib/time/getLocalTime";
import { GetLocalTimeQuery, getLocalTimeQuerySchema } from "@/lib/time/validateGetLocalTimeQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "get_local_time" tool on the MCP server.
 * Gets the current local time/date (now). Use for time/date/clock queries.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetLocalTimeTool(server: McpServer): void {
  server.registerTool(
    "get_local_time",
    {
      description:
        "Get the current local time/date (now). Use for time/date/clock queries. Accepts optional IANA timezone; otherwise uses server locale.",
      inputSchema: getLocalTimeQuerySchema,
    },
    async (args: GetLocalTimeQuery) => {
      const result = await getLocalTime(args);
      return getToolResultSuccess(result);
    },
  );
}
