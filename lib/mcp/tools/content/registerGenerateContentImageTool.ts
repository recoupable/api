import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { callContentEndpoint } from "./callContentEndpoint";

const inputSchema = z.object({
  prompt: z
    .string()
    .optional()
    .describe(
      "Text prompt describing the image to generate. Required unless template is provided.",
    ),
  template: z
    .string()
    .optional()
    .describe(
      "Template ID for curated visual style presets (use list_content_templates to see options).",
    ),
  reference_image_url: z
    .string()
    .url()
    .optional()
    .describe("URL of a reference image for face/style transfer."),
  aspect_ratio: z
    .enum([
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
      "4:1",
      "1:4",
      "8:1",
      "1:8",
    ])
    .optional()
    .describe("Aspect ratio for the generated image. Defaults to 'auto'."),
  resolution: z
    .enum(["0.5K", "1K", "2K", "4K"])
    .optional()
    .describe("Output resolution. Defaults to '1K'."),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe("Number of images to generate (1-4). Defaults to 1."),
});

/**
 * Registers the "generate_content_image" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerGenerateContentImageTool(server: McpServer): void {
  server.registerTool(
    "generate_content_image",
    {
      description:
        "Generate an image from a text prompt, optionally using a reference image for face/style transfer. Supports templates for curated visual styles.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      if (!args.prompt && !args.template) {
        return getToolResultError("At least one of 'prompt' or 'template' must be provided.");
      }

      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/image",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
