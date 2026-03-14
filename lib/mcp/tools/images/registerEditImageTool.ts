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
    async (args: EditImageQuery): Promise<CallToolResult> => {
      const result: GenerateAndProcessImageResult = await generateAndProcessImage(
        args.prompt,
        args.account_id,
        [
          {
            url: args.imageUrl,
            type: "image/png",
          },
        ],
      );

      return getToolResultSuccess(result);
    },
  );
}
