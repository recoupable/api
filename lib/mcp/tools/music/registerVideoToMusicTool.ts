import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { callElevenLabsMusicMultipart } from "@/lib/elevenlabs/callElevenLabsMusicMultipart";
import { elevenLabsOutputFormatSchema } from "@/lib/elevenlabs/outputFormats";

const videoToMusicToolSchema = z.object({
  video_urls: z
    .array(z.string().url())
    .min(1)
    .max(10)
    .describe("URLs to video files (1-10). Each will be downloaded and sent to ElevenLabs."),
  description: z.string().max(1000).optional().describe("Description of desired music style."),
  tags: z.array(z.string()).max(10).optional().describe("Style tags (max 10)."),
  output_format: elevenLabsOutputFormatSchema.optional().describe("Audio output format."),
});

/**
 * Registers the video_to_music MCP tool.
 * Accepts video URLs, downloads them, and generates matching background music.
 *
 * @param server - The MCP server instance.
 */
export function registerVideoToMusicTool(server: McpServer): void {
  server.registerTool(
    "video_to_music",
    {
      description:
        "Generate background music from video files. " +
        "Accepts video URLs (1-10), downloads them, and generates matching music.",
      inputSchema: videoToMusicToolSchema,
    },
    async (
      args: z.infer<typeof videoToMusicToolSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });

      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      try {
        const formData = new FormData();

        for (const url of args.video_urls) {
          const videoResponse = await fetch(url);
          if (!videoResponse.ok) {
            return getToolResultError(`Failed to download video from ${url}`);
          }
          const blob = await videoResponse.blob();
          const filename = url.split("/").pop() ?? "video.mp4";
          formData.append("videos", blob, filename);
        }

        if (args.description) formData.append("description", args.description);
        if (args.tags) {
          for (const tag of args.tags) {
            formData.append("tags", tag);
          }
        }

        const upstream = await callElevenLabsMusicMultipart(
          "/v1/music/video-to-music",
          formData,
          args.output_format,
        );

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "Unknown error");
          return getToolResultError(
            `Video-to-music failed (${upstream.status}): ${errorText}`,
          );
        }

        const songId = upstream.headers.get("song-id");
        return getToolResultSuccess({
          song_id: songId,
          message: "Background music generated from video. Audio is available via POST /api/music/video-to-music.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Video-to-music failed";
        return getToolResultError(message);
      }
    },
  );
}
