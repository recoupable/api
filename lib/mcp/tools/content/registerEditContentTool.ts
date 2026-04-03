import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { callContentEndpoint } from "./callContentEndpoint";

const operationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trim"),
    start: z.number().nonnegative().describe("Start time in seconds."),
    duration: z.number().positive().describe("Duration in seconds."),
  }),
  z.object({
    type: z.literal("crop"),
    aspect: z.string().optional().describe("Target aspect ratio string (e.g. '16:9')."),
    width: z.number().int().positive().optional().describe("Target width in pixels."),
    height: z.number().int().positive().optional().describe("Target height in pixels."),
  }),
  z.object({
    type: z.literal("resize"),
    width: z.number().int().positive().optional().describe("Target width in pixels."),
    height: z.number().int().positive().optional().describe("Target height in pixels."),
  }),
  z.object({
    type: z.literal("overlay_text"),
    content: z.string().min(1).describe("Text content to overlay."),
    font: z.string().optional().describe("Font name."),
    color: z.string().optional().describe("Text color. Defaults to 'white'."),
    stroke_color: z.string().optional().describe("Stroke/outline color. Defaults to 'black'."),
    max_font_size: z
      .number()
      .positive()
      .optional()
      .describe("Maximum font size in pixels. Defaults to 42."),
    position: z
      .enum(["top", "center", "bottom"])
      .optional()
      .describe("Text position on screen. Defaults to 'bottom'."),
  }),
  z.object({
    type: z.literal("mux_audio"),
    audio_url: z.string().url().describe("URL of the audio track to mux in."),
    replace: z.boolean().optional().describe("Replace existing audio track. Defaults to true."),
  }),
]);

const inputSchema = z.object({
  video_url: z
    .string()
    .url()
    .optional()
    .describe("URL of the video to edit. At least one of video_url or audio_url is required."),
  audio_url: z.string().url().optional().describe("URL of the audio to edit."),
  template: z
    .string()
    .optional()
    .describe("Template ID for preset edit operations. Provide template OR operations."),
  operations: z
    .array(operationSchema)
    .optional()
    .describe("Array of edit operations to apply (trim, crop, resize, overlay_text, mux_audio)."),
  output_format: z
    .enum(["mp4", "webm", "mov"])
    .optional()
    .describe("Output format. Defaults to 'mp4'."),
});

/**
 * Registers the "edit_content" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerEditContentTool(server: McpServer): void {
  server.registerTool(
    "edit_content",
    {
      description:
        "Edit content — trim, crop, resize, overlay text, or add audio. " +
        "Pass a template for preset operations, or specify operations manually. " +
        "Returns a background task run ID.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      if (!args.video_url && !args.audio_url) {
        return getToolResultError("At least one of 'video_url' or 'audio_url' must be provided.");
      }
      if (!args.template && (!args.operations || args.operations.length === 0)) {
        return getToolResultError("Provide either 'template' or 'operations'.");
      }

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content",
        "PATCH",
        args as unknown as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
