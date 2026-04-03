import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { callContentEndpoint } from "./callContentEndpoint";

const inputSchema = z.object({
  topic: z
    .string()
    .min(1)
    .describe("Subject or theme for the caption (e.g. 'new album drop', 'summer vibes tour')."),
  length: z
    .enum(["short", "medium", "long"])
    .optional()
    .describe("Caption length tier. Defaults to 'short'."),
  template: z.string().optional().describe("Template ID for caption style and tone presets."),
});

/**
 * Registers the "generate_content_caption" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerGenerateContentCaptionTool(server: McpServer): void {
  server.registerTool(
    "generate_content_caption",
    {
      description: "Generate an on-screen caption or text overlay for social media content.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/caption",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
