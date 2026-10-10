import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { playerOperationSchemas } from "@/lib/players/operationSchemas";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerListReleasePlayerTool(server: McpServer) {
  server.registerTool(
    "list_release_player",
    {
      description: "List registered release players in an authorized workspace.",
      inputSchema: playerOperationSchemas.list,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    getPlayerToolHandler("list"),
  );
}
