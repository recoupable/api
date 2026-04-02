import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { streamBodySchema } from "@/lib/elevenlabs/validateStreamBody";
import { callElevenLabsMusic } from "@/lib/elevenlabs/callElevenLabsMusic";

/**
 * Registers the stream_music MCP tool.
 * Generates a song via the streaming endpoint.
 * MCP tools can't stream, so this buffers the response and returns the song-id.
 *
 * @param server - The MCP server instance.
 */
export function registerStreamMusicTool(server: McpServer): void {
  server.registerTool(
    "stream_music",
    {
      description:
        "Generate a song using the streaming endpoint. " +
        "Returns the song-id. Streaming playback is only available via the REST API.",
      inputSchema: streamBodySchema,
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
          "/v1/music/stream",
          body,
          output_format,
        );

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "Unknown error");
          return getToolResultError(`Music streaming failed (${upstream.status}): ${errorText}`);
        }

        const songId = upstream.headers.get("song-id");
        return getToolResultSuccess({
          song_id: songId,
          message: "Song generated successfully. Streaming playback is available via POST /api/music/stream.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Music streaming failed";
        return getToolResultError(message);
      }
    },
  );
}
