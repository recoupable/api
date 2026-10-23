import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { type FlamingoGenerateBody } from "@/lib/flamingo/flamingoGenerateBodySchema";
import { analyzeMusicToolSchema, type AnalyzeMusicToolInput } from "./analyzeMusicToolSchema";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { minimumCreditsForAnalyzeRequest } from "@/lib/flamingo/minimumCreditsForAnalyzeRequest";
import { verifyAudioUrl } from "@/lib/flamingo/verifyAudioUrl";

/**
 * Registers the analyze_music MCP tool on the server.
 * Supports custom prompts and curated presets (including full_report).
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerAnalyzeMusicTool(server: McpServer): void {
  server.registerTool(
    "analyze_music",
    {
      description:
        "Analyze music or answer music questions using Recoupable's Audio Language Model. " +
        "Accepts either a 'preset' name for structured analysis (e.g. 'catalog_metadata', 'mood_tags', 'sync_brief_match', 'full_report') " +
        "or a custom 'prompt' for free-form questions about the audio. " +
        "Prefer the audio file attached to the conversation via file. Alternatively accept audio_url. " +
        "Provide exactly one source (MP3, WAV, FLAC; up to 20 minutes). " +
        "Use the host-supplied file object; do not ask users to host audio or invent a download URL. " +
        "If no audio is attached, ask them to attach their song. Default to catalog_metadata for a song overview.",
      inputSchema: analyzeMusicToolSchema,
      _meta: { "openai/fileParams": ["file"] },
    },
    async (
      args: AnalyzeMusicToolInput,
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
        return getToolResultError("Failed to resolve account ID");
      }

      const parsed = analyzeMusicToolSchema.safeParse(args);
      if (!parsed.success) {
        return getToolResultError(parsed.error.issues[0].message);
      }
      const { file, ...input } = parsed.data;
      const params: FlamingoGenerateBody = {
        ...input,
        audio_url: file?.download_url ?? input.audio_url!,
      };
      const audio = await verifyAudioUrl(params.audio_url);
      if (audio.ok === false) {
        return getToolResultError(
          file
            ? audio.error === "audio_url_not_audio"
              ? "The attached file could not be read as audio. Attach an MP3, WAV, or FLAC file."
              : "The attached audio could not be accessed. Please attach the song again and retry."
            : audio.message,
        );
      }

      let gate;
      try {
        gate = await checkCreditsAvailable({
          accountId,
          creditsToDeduct: minimumCreditsForAnalyzeRequest(params),
        });
      } catch (err) {
        console.error("[analyze_music] credit gate failed:", err);
        return getToolResultError("Credit check failed");
      }
      if (gate.kind === "insufficient_credits") {
        return getToolResultError(
          `Insufficient credits: ${gate.remainingCredits} remaining, ${gate.requiredCredits} required`,
        );
      }

      let result;
      try {
        result = await processAnalyzeMusicRequest(params, {
          accountId,
          ...(file ? { recordAudioUrl: false } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        return getToolResultError(`Music analysis failed: ${message}`);
      }

      if (result.type === "error") {
        return getToolResultError(result.error);
      }

      const { type: _, ...data } = result;
      return getToolResultSuccess(data);
    },
  );
}
