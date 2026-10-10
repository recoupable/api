import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { playerOperationSchemas } from "@/lib/players/operationSchemas";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerGetReleasePlayerTool(server: McpServer) {
  server.registerTool(
    "get_release_player",
    {
      description: "Read release player configuration, current revision and share/embed links.",
      inputSchema: playerOperationSchemas.get,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    getPlayerToolHandler("get"),
  );
}
