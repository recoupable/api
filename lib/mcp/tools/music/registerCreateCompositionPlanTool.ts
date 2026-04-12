import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { createPlanBodySchema } from "@/lib/elevenlabs/validateCreatePlanBody";
import { callElevenLabsMusic } from "@/lib/elevenlabs/callElevenLabsMusic";

/**
 * Registers the create_composition_plan MCP tool.
 * Creates a detailed composition plan from a text prompt.
 * Free — does not consume ElevenLabs credits.
 *
 * @param server - The MCP server instance.
 */
export function registerCreateCompositionPlanTool(server: McpServer): void {
  server.registerTool(
    "create_composition_plan",
    {
      description:
        "Create a detailed composition plan from a text prompt. Free — does not consume credits. " +
        "Use this before compose_music to preview and tweak the song structure, styles, and sections.",
      inputSchema: createPlanBodySchema,
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

      try {
        const upstream = await callElevenLabsMusic("/v1/music/plan", args);

        if (!upstream.ok) {
          const errorText = await upstream.text().catch(() => "Unknown error");
          return getToolResultError(`Plan creation failed (${upstream.status}): ${errorText}`);
        }

        const plan = await upstream.json();
        return getToolResultSuccess(plan);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Plan creation failed";
        return getToolResultError(message);
      }
    },
  );
}
