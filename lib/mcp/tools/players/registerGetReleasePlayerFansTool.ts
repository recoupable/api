import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerGetReleasePlayerFansTool(server: McpServer) {
  server.registerTool(
    "get_release_player_fans",
    {
      description:
        "Read available Spotify-confirmed email/profile across this artist's release players in the authorized workspace. No marketing consent or provider tokens are returned.",
      inputSchema: z
        .object({
          id: z.string().uuid(),
          organizationId: z.string().uuid().nullable().default(null),
          offset: z.number().int().min(0).max(100000).default(0),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    getPlayerToolHandler("fans"),
  );
}
