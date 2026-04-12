import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { composeDetailedBodySchema } from "@/lib/elevenlabs/validateComposeDetailedBody";
import { callElevenLabsMusic } from "@/lib/elevenlabs/callElevenLabsMusic";

/**
 * Registers the compose_music_detailed MCP tool.
 * Generates a song with detailed metadata and optional word timestamps.
 *
 * @param server - The MCP server instance.
 */
export function registerComposeDetailedMusicTool(server: McpServer): void {
  server.registerTool(
    "compose_music_detailed",
    {
      description:
        "Generate a song with detailed metadata and optional word timestamps. " +
        "Returns the song-id. Set with_timestamps to true for word-level timing data. " +
        "Audio is available via the REST API.",
      inputSchema: composeDetailedBodySchema,
    },
    async (
      args: Record<string, unknown>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });

      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      const { output_format, ...body } = args as Record<string, unknown> & {
        output_format?: string;
      };

      try {
        const upstream = await callElevenLabsMusic(
          "/v1/music/detailed",
          body,
          output_format,
        );

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "Unknown error");
          return getToolResultError(
            `Detailed music generation failed (${upstream.status}): ${errorText}`,
          );
        }

        const songId = upstream.headers.get("song-id");
        return getToolResultSuccess({
          song_id: songId,
          message: "Song generated with detailed metadata. Audio is available via POST /api/music/compose/detailed.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Detailed music generation failed";
        return getToolResultError(message);
      }
    },
  );
}
