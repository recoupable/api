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
import {
  generateImageQuerySchema,
  type GenerateImageQuery,
} from "@/lib/image/validateGenerateImageQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "generate_image" tool on the MCP server.
 * Generates an image based on a text prompt.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGenerateImageTool(server: McpServer): void {
  server.registerTool(
    "generate_image",
    {
      description: "Generate an image based on a text prompt.",
      inputSchema: generateImageQuerySchema,
    },
    async (
      args: GenerateImageQuery,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId: uploaderAccountId, error: authError } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (authError || !uploaderAccountId)
        return getToolResultError(authError || "Authentication required");

      const result: GenerateAndProcessImageResult = await generateAndProcessImage(
        args.prompt,
        args.account_id,
        undefined,
        uploaderAccountId,
      );

      return getToolResultSuccess(result);
    },
  );
}
