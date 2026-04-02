import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { composeBodySchema } from "@/lib/elevenlabs/validateComposeBody";
import { callElevenLabsMusic } from "@/lib/elevenlabs/callElevenLabsMusic";

/**
 * Registers the compose_music MCP tool.
 * Generates a song, saves audio to Supabase storage, and returns the URL.
 *
 * @param server - The MCP server instance.
 */
export function registerComposeMusicTool(server: McpServer): void {
  server.registerTool(
    "compose_music",
    {
      description:
        "Generate a song from a text prompt or composition plan using ElevenLabs Music AI. " +
        "Provide either a 'prompt' (text description) or a 'composition_plan' (structured plan from create_composition_plan), not both. " +
        "Returns the song-id and audio content type. Use create_composition_plan first to preview the plan before spending credits.",
      inputSchema: composeBodySchema,
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
          "/v1/music",
          body,
          output_format,
        );

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "Unknown error");
          return getToolResultError(`Music generation failed (${upstream.status}): ${errorText}`);
        }

        const songId = upstream.headers.get("song-id");
        return getToolResultSuccess({
          song_id: songId,
          message: "Song generated successfully. Audio is available via the REST API at POST /api/music/compose.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Music generation failed";
        return getToolResultError(message);
      }
    },
  );
}
