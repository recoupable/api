import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const inputSchema = z.object({
  artist_account_id: z
    .string()
    .uuid()
    .describe(
      "The artist's account ID (UUID). This is the target artist, not the caller's account.",
    ),
  template: z
    .string()
    .optional()
    .describe("Template ID for the content pipeline (use list_content_templates to see options)."),
  lipsync: z
    .boolean()
    .optional()
    .describe("Enable lipsync mode for the video step. Defaults to false."),
  caption_length: z
    .enum(["short", "medium", "long"])
    .optional()
    .describe("Length of the generated caption. Defaults to 'short'."),
  batch: z
    .number()
    .int()
    .min(1)
    .max(30)
    .optional()
    .describe("Number of content pieces to generate in parallel (1-30). Defaults to 1."),
  songs: z
    .array(z.string())
    .optional()
    .describe("Array of song URLs or identifiers to use in content creation."),
});

/**
 * Registers the "create_content" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerCreateContentTool(server: McpServer): void {
  server.registerTool(
    "create_content",
    {
      description:
        "Run the full content creation pipeline in one call. " +
        "Generates image, video, caption, and edit for an artist. " +
        "Returns background task run IDs.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/create",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
