import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateVideoFunction } from "@/lib/video/generateVideo";
import {
  generateVideoQuerySchema,
  type GenerateVideoQuery,
} from "@/lib/video/validateGenerateVideoQuery";

/**
 * Registers the "generate_sora_2_video" tool on the MCP server.
 * Generate a video from a text prompt using OpenAI's Sora 2 model.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGenerateVideoTool(server: McpServer): void {
  server.registerTool(
    "generate_sora_2_video",
    {
      description: `Generate a video from a text prompt using OpenAI's Sora 2 model.
    
    This tool creates high-quality videos based on detailed text descriptions.
    
    IMPORTANT:
    - Provide detailed, vivid descriptions for best results
    - Videos can be 4 to 20 seconds in length
    - Supported sizes: 720x1280 (default portrait), 1280x720 (landscape)
    - Generation may take several minutes to complete`,
      inputSchema: generateVideoQuerySchema,
    },
    async (args: GenerateVideoQuery) => {
      const result = await generateVideoFunction(args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    },
  );
}
