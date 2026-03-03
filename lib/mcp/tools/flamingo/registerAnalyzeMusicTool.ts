import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { getPreset, PRESET_NAMES } from "@/lib/flamingo/presets";
import { FULL_REPORT_PRESET_NAME } from "@/lib/flamingo/presets/fullReport";
import { executeFullReport } from "@/lib/flamingo/executeFullReport";

/**
 * Zod schema for the analyze_music MCP tool input.
 * Supports both custom prompts and curated presets.
 */
const analyzeMusicSchema = z.object({
  preset: z
    .enum(PRESET_NAMES as unknown as [string, ...string[]])
    .optional()
    .describe(
      "Name of a curated analysis preset (e.g. 'catalog_metadata', 'mood_tags', 'full_report'). Use instead of prompt for structured output.",
    ),
  prompt: z
    .string()
    .max(24000)
    .optional()
    .describe(
      "Custom text prompt or question about the music. Use when no preset fits your needs.",
    ),
  audio_url: z
    .string()
    .url()
    .optional()
    .describe("Public URL to an audio file (MP3, WAV, FLAC — up to 20 min)"),
  max_new_tokens: z
    .number()
    .int()
    .min(1)
    .max(2048)
    .optional()
    .describe("Maximum tokens to generate (default 512). Ignored when using a preset."),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe("Controls creativity (default 1.0). Ignored when using a preset."),
  top_p: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Nucleus sampling cutoff (default 1.0). Ignored when using a preset."),
  do_sample: z
    .boolean()
    .optional()
    .describe("Enable sampling (default false). Ignored when using a preset."),
});

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
      inputSchema: analyzeMusicSchema,
    },
    async (
      args: z.infer<typeof analyzeMusicSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      // Authenticate via authInfo
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

      // Validate: need either preset or prompt
      if (!args.preset && !args.prompt) {
        return getToolResultError(
          "Either 'preset' or 'prompt' is required. Available presets: " +
            PRESET_NAMES.join(", "),
        );
      }

      try {
        console.info("[MCP] analyze_music request", {
          accountId,
          preset: args.preset ?? null,
          hasAudioUrl: Boolean(args.audio_url),
        });

        // Handle full_report preset
        if (args.preset === FULL_REPORT_PRESET_NAME) {
          if (!args.audio_url) {
            return getToolResultError(
              "audio_url is required for the full_report preset",
            );
          }
          const { report, elapsed_seconds } = await executeFullReport(
            args.audio_url,
          );
          return getToolResultSuccess({ preset: "full_report", report, elapsed_seconds });
        }

        // Resolve individual preset
        let prompt = args.prompt ?? "";
        let maxNewTokens = args.max_new_tokens;
        let temperature: number | undefined;
        let topP = args.top_p;
        let doSample: boolean | undefined;
        let parseResponse: ((raw: string) => unknown) | undefined;

        if (args.preset) {
          const preset = getPreset(args.preset);
          if (!preset) {
            return getToolResultError(`Unknown preset: ${args.preset}`);
          }
          if (preset.requiresAudio && !args.audio_url) {
            return getToolResultError(
              `The "${preset.name}" preset requires an audio_url`,
            );
          }
          prompt = preset.prompt;
          maxNewTokens = preset.params.max_new_tokens;
          temperature = preset.params.temperature;
          topP = undefined;
          doSample = preset.params.do_sample;
          parseResponse = preset.parseResponse;
        }

        // Call Flamingo
        const result = await callFlamingoGenerate({
          prompt,
          audio_url: args.audio_url,
          max_new_tokens: maxNewTokens,
          temperature,
          top_p: topP,
          do_sample: doSample,
        });

        // Apply post-processing
        let response: unknown = result.response;
        if (parseResponse) {
          try {
            response = parseResponse(result.response);
          } catch {
            response = result.response;
          }
        }

        return getToolResultSuccess({
          ...(args.preset ? { preset: args.preset } : {}),
          response,
          elapsed_seconds: result.elapsed_seconds,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Flamingo inference failed";
        return getToolResultError(`Music analysis failed: ${message}`);
      }
    },
  );
}
