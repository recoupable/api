import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const inputSchema = z.object({
  audio_urls: z.array(z.string().url()).min(1).describe("Array of audio file URLs to transcribe."),
  language: z
    .string()
    .optional()
    .describe("Language code for transcription (e.g. 'en', 'es'). Defaults to 'en'."),
  chunk_level: z
    .enum(["none", "segment", "word"])
    .optional()
    .describe("Granularity of timestamp chunks: 'none', 'segment', or 'word'. Defaults to 'word'."),
});

/**
 * Registers the "transcribe_content_audio" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerTranscribeContentAudioTool(server: McpServer): void {
  server.registerTool(
    "transcribe_content_audio",
    {
      description:
        "Transcribe audio to timestamped text. Returns full lyrics and individual word/segment timestamps.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/transcribe",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
