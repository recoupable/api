import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  flamingoGenerateBodySchema,
  type FlamingoGenerateBody,
} from "@/lib/flamingo/validateFlamingoGenerateBody";
import { processAnalyzeMusicRequest } from "@/lib/flamingo/processAnalyzeMusicRequest";

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
        "Analyze music or answer music questions using the Music Flamingo model (NVIDIA, 8B params). " +
        "Accepts either a 'preset' name for structured analysis (e.g. 'catalog_metadata', 'mood_tags', 'sync_brief_match', 'full_report') " +
        "or a custom 'prompt' for free-form questions. " +
        "Most presets require an audio_url. Audio files can be up to 20 minutes (MP3, WAV, FLAC).",
      inputSchema: flamingoGenerateBodySchema,
    },
    async (
      args: FlamingoGenerateBody,
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

      let result;
      try {
        result = await processAnalyzeMusicRequest(args);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Flamingo inference failed";
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
