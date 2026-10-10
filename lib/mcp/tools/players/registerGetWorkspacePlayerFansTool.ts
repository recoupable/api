import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { workspacePlayerFansQuerySchema } from "@/lib/players/validateWorkspacePlayerFansQuery";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerGetWorkspacePlayerFansTool(server: McpServer) {
  server.registerTool(
    "get_workspace_player_fans",
    {
      description:
        "Read one Spotify fan contact per authorized workspace, with its artist relationships. No cross-workspace identity links, provider tokens or email marketing consent.",
      inputSchema: workspacePlayerFansQuerySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    getPlayerToolHandler("workspaceFans"),
  );
}
