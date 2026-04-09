import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const inputSchema = z.object({
  url: z.string().url().describe("URL of the image or video to upscale."),
  type: z.enum(["image", "video"]).describe("Whether the input is an image or video."),
  upscale_factor: z
    .number()
    .min(1)
    .max(4)
    .optional()
    .describe("Upscale multiplier (1-4). Defaults to 2."),
  target_resolution: z
    .enum(["720p", "1080p", "1440p", "2160p"])
    .optional()
    .describe("Target resolution instead of a factor. Overrides upscale_factor when set."),
});

/**
 * Registers the "upscale_content" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerUpscaleContentTool(server: McpServer): void {
  server.registerTool(
    "upscale_content",
    {
      description: "Upscale an image or video to higher resolution (up to 4x or 4K).",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/upscale",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
