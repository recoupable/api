import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const inputSchema = z.object({
  video_url: z.string().url().describe("URL of the video to analyze."),
  prompt: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "Question or instruction for the analysis (e.g. 'Describe all scenes', 'Count the number of people').",
    ),
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Sampling temperature for the AI response (0-1). Lower = more deterministic. Defaults to 0.2.",
    ),
  max_tokens: z
    .number()
    .int()
    .min(1)
    .max(4096)
    .optional()
    .describe("Maximum tokens in the response."),
});

/**
 * Registers the "analyze_content_video" tool on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerAnalyzeContentVideoTool(server: McpServer): void {
  server.registerTool(
    "analyze_content_video",
    {
      description:
        "Analyze a video with AI. Describe scenes, check quality, count subjects, " +
        "evaluate for social media — ask anything about the video.",
      inputSchema,
    },
    async (
      args: z.infer<typeof inputSchema>,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { data, error } = await callContentEndpoint(
        "/api/content/analyze",
        "POST",
        args as Record<string, unknown>,
        authInfo,
      );

      if (error) return getToolResultError(error);
      return getToolResultSuccess(data);
    },
  );
}
