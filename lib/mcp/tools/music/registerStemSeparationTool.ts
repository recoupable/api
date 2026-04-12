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

const stemSeparationToolSchema = z.object({
  audio_url: z.string().url().describe("URL to the audio file to separate into stems."),
  stem_variation_id: z
    .enum(["two_stems_v1", "six_stems_v1"])
    .optional()
    .default("six_stems_v1")
    .describe("Two stems (vocals + accompaniment) or six stems (vocals, drums, bass, guitar, piano, other)."),
  output_format: elevenLabsOutputFormatSchema.optional().describe("Audio output format for stems."),
});

/**
 * Registers the separate_stems MCP tool.
 * Accepts an audio URL, downloads it, separates into stems via ElevenLabs.
 *
 * @param server - The MCP server instance.
 */
export function registerStemSeparationTool(server: McpServer): void {
  server.registerTool(
    "separate_stems",
    {
      description:
        "Separate an audio file into individual stems (vocals, drums, bass, etc.). " +
        "Accepts an audio URL. Choose two_stems_v1 or six_stems_v1.",
      inputSchema: stemSeparationToolSchema,
    },
    async (
      args: z.infer<typeof stemSeparationToolSchema>,
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
        const audioResponse = await fetch(args.audio_url);
        if (!audioResponse.ok) {
          return getToolResultError(`Failed to download audio from ${args.audio_url}`);
        }
        const blob = await audioResponse.blob();
        const filename = args.audio_url.split("/").pop() ?? "audio.mp3";

        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("stem_variation_id", args.stem_variation_id);

        const upstream = await callElevenLabsMusicMultipart(
          "/v1/music/stem-separation",
          formData,
          args.output_format,
        );

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "Unknown error");
          return getToolResultError(
            `Stem separation failed (${upstream.status}): ${errorText}`,
          );
        }

        return getToolResultSuccess({
          message: "Audio separated into stems. ZIP archive is available via POST /api/music/stem-separation.",
          stem_variation: args.stem_variation_id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stem separation failed";
        return getToolResultError(message);
      }
    },
  );
}
