import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { playerOperationSchemas } from "@/lib/players/operationSchemas";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerUpdateReleasePlayerTool(server: McpServer) {
  server.registerTool(
    "update_release_player",
    {
      description:
        "Edit release player branding, destinations, freePlayback (spotify or uploaded audio), audioUrl, approved embed origins or enabled with the current revision. Artist/owner cannot change. Enabling publishes; require explicit publication authorization. Changes invalidate current listening sessions.",
      inputSchema: playerOperationSchemas.update,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    getPlayerToolHandler("update"),
  );
}
