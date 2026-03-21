import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { generateArtistIntelPack } from "@/lib/artistIntel/generateArtistIntelPack";

const toolSchema = z.object({
  artist_name: z
    .string()
    .min(1)
    .describe("The artist name to analyze (e.g. 'Taylor Swift', 'Bad Bunny', 'Olivia Rodrigo')."),
});

/**
 * Registers the generate_artist_intel_pack MCP tool on the server.
 *
 * This tool generates a complete Artist Intelligence Pack by combining:
 * - Spotify metadata (genres, followers, popularity, top tracks)
 * - MusicFlamingo NVIDIA AI (8B params) — analyzes the artist's actual audio via a
 *   Spotify 30-second preview URL. Returns genre/BPM/key/mood, audience demographics,
 *   playlist pitch targets, and mood/vibe tags.
 * - Perplexity web research — recent press, streaming news, trends.
 * - AI synthesis — ready-to-use playlist pitch email, social captions, and press release.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGenerateArtistIntelPackTool(server: McpServer): void {
  server.registerTool(
    "generate_artist_intel_pack",
    {
      description:
        "Generate a complete Artist Intelligence Pack for any artist. " +
        "Combines Spotify metadata, MusicFlamingo NVIDIA AI audio analysis (analyzes the artist's actual music — " +
        "genre, BPM, key, mood, audience demographics, playlist pitch targets), and Perplexity web research into " +
        "a comprehensive marketing intelligence report. " +
        "Returns: artist profile, top track, music DNA from AI audio scan, web context, and a ready-to-use " +
        "marketing pack (playlist pitch email, Instagram/TikTok/Twitter captions, press release opener, " +
        "key talking points). " +
        "Use this when you need to deeply research an artist or prepare marketing materials for them.",
      inputSchema: toolSchema,
    },
    async (
      args: { artist_name: string },
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });

      if (error) {
        return getToolResultError(error);
      }

      if (!accountId) {
        return getToolResultError("Authentication required.");
      }

      const result = await generateArtistIntelPack(args.artist_name);

      if (result.type === "error") {
        return getToolResultError(result.error);
      }

      return getToolResultSuccess(result.pack);
    },
  );
}
