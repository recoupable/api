import { getToolResultError } from "@/lib/mcp/getToolResultError";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  generateAndProcessImage,
  type GenerateAndProcessImageResult,
} from "@/lib/image/generateAndProcessImage";
import { editImageQuerySchema, type EditImageQuery } from "@/lib/image/validateEditImageQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { CallToolResult } from "@/lib/mcp/getCallToolResult";

/**
 * Registers the "edit_image" tool on the MCP server.
 * Edits existing images based on text prompts while preserving the original context and style.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerEditImageTool(server: McpServer): void {
  server.registerTool(
    "edit_image",
    {
      inputSchema: editImageQuerySchema,
      description: "Edit existing images.",
    },
    async (
      args: EditImageQuery,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ): Promise<CallToolResult> => {
      const { accountId: uploaderAccountId, error: authError } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (authError || !uploaderAccountId)
        return getToolResultError(authError || "Authentication required");

      const result: GenerateAndProcessImageResult = await generateAndProcessImage(
        args.prompt,
        args.account_id,
        [
          {
            url: args.imageUrl,
            type: "image/png",
          },
        ],
        uploaderAccountId,
      );

      return getToolResultSuccess(result);
    },
  );
}
