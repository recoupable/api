import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getComposioTools } from "@/lib/composio/toolRouter";
import { getCallToolResult } from "@/lib/mcp/getCallToolResult";

export function registerComposioTools(server: McpServer): void {
  server.registerTool(
    "composio",
    {
      description: "Get Composio tools for Google Sheets integration.",
      inputSchema: z.object({
        account_id: z.string().min(1),
        room_id: z.string().optional(),
      }),
    },
    async (args) => {
      const tools = await getComposioTools(args.account_id, args.room_id);
      return getCallToolResult(JSON.stringify(tools));
    }
  );
}
