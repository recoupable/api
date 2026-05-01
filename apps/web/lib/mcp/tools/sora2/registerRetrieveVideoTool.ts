import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { retrieveVideoFunction } from "@/lib/video/retrieveVideo";
import {
  retrieveVideoQuerySchema,
  type RetrieveVideoQuery,
} from "@/lib/video/validateRetrieveVideoQuery";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";

/**
 * Registers the "retrieve_sora_2_video" tool on the MCP server.
 * Retrieve the status and details of a video generation job.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerRetrieveVideoTool(server: McpServer): void {
  server.registerTool(
    "retrieve_sora_2_video",
    {
      description: `Retrieve the status and details of a video generation job.
    
    Use this tool to:
    - Check the progress of a video generation job
    - Check if the video is completed, failed, or still processing
    - Get job details like progress, created_at, size, and seconds
    
    IMPORTANT:
    - Requires the video_id from generate_sora_2_video tool
    - Status can be: "queued", "processing", "completed", or "failed"
    - Progress field shows 0-100 for processing jobs`,
      inputSchema: retrieveVideoQuerySchema,
    },
    async (args: RetrieveVideoQuery) => {
      const result = await retrieveVideoFunction(args);
      return getToolResultSuccess(result);
    },
  );
}
