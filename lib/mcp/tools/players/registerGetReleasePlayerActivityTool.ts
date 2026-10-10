import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlayerToolHandler } from "./getPlayerToolHandler";
export function registerGetReleasePlayerActivityTool(server: McpServer) {
  server.registerTool(
    "get_release_player_activity",
    {
      description:
        "Read private 30-day browser listening totals, campaign attribution and fan-linked track/play/pause/skip history. Reported SDK observations are not DSP stream totals or listening outside this player.",
      inputSchema: z
        .object({
          id: z.string().uuid(),
          organizationId: z.string().uuid().nullable().default(null),
          offset: z.number().int().min(0).max(100000).default(0),
        })
        .strict(),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    getPlayerToolHandler("activity"),
  );
}
