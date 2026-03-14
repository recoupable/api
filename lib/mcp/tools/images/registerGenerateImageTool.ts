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
    async (args: GenerateImageQuery) => {
      const result: GenerateAndProcessImageResult = await generateAndProcessImage(
        args.prompt,
        args.account_id,
      );

      return getToolResultSuccess(result);
    },
  );
}
