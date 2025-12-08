import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { retrieveVideoContentFunction } from "@/lib/video/retrieveVideoContent";
import {
  retrieveVideoQuerySchema,
  type RetrieveVideoQuery,
} from "@/lib/video/validateRetrieveVideoQuery";

/**
 * Registers the "retrieve_sora_2_video_content" tool on the MCP server.
 * Download and retrieve the rendered video content for a completed video generation job.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerRetrieveVideoContentTool(server: McpServer): void {
  server.registerTool(
    "retrieve_sora_2_video_content",
    {
      description: `Download and retrieve the rendered video content for a completed video generation job.
    
    Use this tool to:
    - Download the actual video file after generation is complete
    - Get metadata about the video file (size, content type)
    - Verify that the video content is available
    
    IMPORTANT:
    - Requires the video_id from generate_sora_2_video tool
    - Only works when video status is "completed" (check with retrieve_sora_2_video first)
    - Downloads the actual video file content (this may take some time)
    - Returns video metadata including file size and content type`,
      inputSchema: retrieveVideoQuerySchema,
    },
    async (args: RetrieveVideoQuery) => {
      const result = await retrieveVideoContentFunction(args);

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
