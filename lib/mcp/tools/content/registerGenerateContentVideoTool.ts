import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const inputSchema = z.object({
  mode: z
    .enum(["prompt", "animate", "reference", "extend", "first-last", "lipsync"])
    .optional()
    .describe(
      "Video generation mode. Auto-inferred from inputs if omitted. " +
        "'prompt' = text-to-video, 'animate' = image-to-video, 'reference' = style reference, " +
        "'extend' = continue a video, 'first-last' = transition between two images, " +
        "'lipsync' = sync face to audio.",
    ),
  prompt: z.string().optional().describe("Text prompt describing the video to generate."),
  image_url: z
    .string()
    .url()
    .optional()
    .describe("URL of an input image (for animate, reference, first-last, or lipsync modes)."),
  end_image_url: z
    .string()
    .url()
    .optional()
    .describe("URL of the ending frame image (for first-last mode)."),
  video_url: z.string().url().optional().describe("URL of a video to extend (for extend mode)."),
  audio_url: z.string().url().optional().describe("URL of audio for lipsync mode."),
  template: z.string().optional().describe("Template ID for curated style presets."),
  aspect_ratio: z
    .enum(["auto", "16:9", "9:16"])
    .optional()
    .describe("Aspect ratio for the generated video. Defaults to 'auto'."),
  duration: z
    .enum(["4s", "6s", "7s", "8s"])
    .optional()
    .describe("Video duration. Defaults to '8s'."),
});

/**
 * Registers the "generate_content_video" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerGenerateContentVideoTool(server: McpServer): void {
  server.registerTool(
    "generate_content_video",
    {
      description:
        "Generate a video. Supports 6 modes: prompt (text-to-video), animate (image-to-video), " +
        "reference (style reference), extend (continue a video), first-last (transition between images), " +
        "lipsync (face sync to audio). Mode is auto-inferred from inputs if not specified.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/video",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
