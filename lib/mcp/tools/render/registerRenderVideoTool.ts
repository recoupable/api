import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { triggerRenderVideo } from "@/lib/trigger/triggerRenderVideo";

/** Schema for the render_video MCP tool arguments. */
const renderVideoSchema = z.object({
  compositionId: z
    .string()
    .describe(
      'The composition ID to render (e.g., "SocialPost", "UpdatesAnnouncement", "CommitShowcase")',
    ),
  inputProps: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Input props to pass to the composition. Structure depends on the composition being rendered.",
    ),
  width: z
    .number()
    .int()
    .min(1)
    .max(3840)
    .optional()
    .describe("Output width in pixels (default 720)"),
  height: z
    .number()
    .int()
    .min(1)
    .max(3840)
    .optional()
    .describe("Output height in pixels (default 1280)"),
  fps: z.number().int().min(1).max(60).optional().describe("Frames per second (default 30)"),
  durationInFrames: z
    .number()
    .int()
    .min(1)
    .max(1800)
    .optional()
    .describe("Total frames to render. At 30 fps, 240 frames = 8 seconds (default 240)"),
  codec: z.enum(["h264", "h265", "vp8", "vp9"]).optional().describe('Video codec (default "h264")'),
});

/**
 * Registers the "render_video" MCP tool.
 *
 * Triggers a server-side video render as a background task and returns
 * a run ID that can be polled for status. Uses the same shared
 * triggerRenderVideo function as the REST API endpoint.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerRenderVideoTool(server: McpServer): void {
  server.registerTool(
    "render_video",
    {
      description: `Trigger a server-side video render. Returns a run ID that can be polled for status and the rendered video URL.

IMPORTANT:
- compositionId is required — it must match a registered composition
- inputProps vary by composition (e.g., SocialPost needs videoUrl, captionText)
- The render runs in the background; poll the returned runId for completion
- Default output: 720×1280 at 30 fps, 8 seconds, h264 codec`,
      inputSchema: renderVideoSchema,
    },
    async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      // Use resolveAccountId for consistent auth handling (supports org key overrides)
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

      try {
        const handle = await triggerRenderVideo({
          compositionId: args.compositionId,
          inputProps: args.inputProps ?? {},
          width: args.width ?? 720,
          height: args.height ?? 1280,
          fps: args.fps ?? 30,
          durationInFrames: args.durationInFrames ?? 240,
          codec: args.codec ?? "h264",
          accountId,
        });

        return getToolResultSuccess({
          status: "processing",
          runId: handle.id,
          message: "Video render triggered. Poll for status using the runId.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to trigger video render";
        return getToolResultError(message);
      }
    },
  );
}
