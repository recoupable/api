import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { playerOperationSchemas } from "@/lib/players/operationSchemas";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerCreateReleasePlayerTool(server: McpServer) {
  server.registerTool(
    "create_release_player",
    {
      description:
        "Register one API-owned release listening page and Spotify/Apple embeds for an artist in the authenticated workspace. Disabled by default. Only enable when publication is explicitly authorized; requires paid entitlement. No site generation required. freePlayback defaults to spotify; audio requires a workspace-owned audioUrl uploaded through /api/sites/assets.",
      inputSchema: playerOperationSchemas.create,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    getPlayerToolHandler("create"),
  );
}
