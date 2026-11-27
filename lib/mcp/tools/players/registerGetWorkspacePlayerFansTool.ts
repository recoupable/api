import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { workspacePlayerFansQuerySchema } from "@/lib/players/validateWorkspacePlayerFansQuery";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerGetWorkspacePlayerFansTool(server: McpServer) {
  server.registerTool(
    "get_workspace_player_fans",
    {
      description:
        "List fan contacts for release players in a Recoup workspace you can access. Each contact appears once and includes their Spotify display name and email when available, plus the artists they connected with. A connection does not grant marketing consent.",
      inputSchema: workspacePlayerFansQuerySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    getPlayerToolHandler("workspaceFans"),
  );
}
