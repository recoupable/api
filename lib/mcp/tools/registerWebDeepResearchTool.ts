import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chatWithPerplexity } from "@/lib/perplexity/chatWithPerplexity";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const webDeepResearchSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string().describe("The role of the message sender (user, assistant, system)"),
        content: z.string().describe("The content of the message"),
      }),
    )
    .min(1, "At least one message is required")
    .describe("Array of messages for the research query"),
});

type WebDeepResearchArgs = z.infer<typeof webDeepResearchSchema>;

/**
 * Registers the "web_deep_research" tool on the MCP server.
 * Performs deep web research using Perplexity's sonar-deep-research model.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerWebDeepResearchTool(server: McpServer): void {
  server.registerTool(
    "web_deep_research",
    {
      description:
        "Deep web research tool for comprehensive, multi-source analysis. " +
        "Use this when you need thorough research on complex topics that require synthesizing information from many sources. " +
        "This tool performs more extensive research than the standard web search. " +
        "Accepts an array of messages and returns comprehensive research results with citations.",
      inputSchema: webDeepResearchSchema,
    },
    async (args: WebDeepResearchArgs) => {
      try {
        const { messages } = args;

        if (!messages || messages.length === 0) {
          return getToolResultError("messages array is required and cannot be empty");
        }

        const result = await chatWithPerplexity(messages, "sonar-deep-research");

        let finalContent = result.content;

        // Append citations if available
        if (result.citations.length > 0) {
          finalContent += "\n\nCitations:\n";
          result.citations.forEach((citation, index) => {
            finalContent += `[${index + 1}] ${citation}\n`;
          });
        }

        return getToolResultSuccess(finalContent);
      } catch (error) {
        return getToolResultError(
          error instanceof Error
            ? `Deep research failed: ${error.message}`
            : "Deep research failed",
        );
      }
    },
  );
}
