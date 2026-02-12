import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchPerplexity } from "@/lib/perplexity/searchPerplexity";
import { formatSearchResultsAsMarkdown } from "@/lib/perplexity/formatSearchResultsAsMarkdown";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";

const searchWebSchema = z.object({
  query: z.string().min(1, "Search query is required").describe("The search query"),
  max_results: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .describe("Maximum number of results (1-20, default: 10)"),
  country: z
    .string()
    .length(2)
    .optional()
    .describe("ISO country code for regional results (e.g., 'US', 'GB')"),
});

type SearchWebArgs = z.infer<typeof searchWebSchema>;

/**
 * Registers the "search_web" tool on the MCP server.
 * Searches the web for real-time information using Perplexity API.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerSearchWebTool(server: McpServer): void {
  server.registerTool(
    "search_web",
    {
      description:
        "DEFAULT TOOL: Use this tool FIRST for any information you're unsure about. " +
        "NEVER respond with 'I can't find X', 'I don't have access to X', or 'I do not know X'. " +
        "This tool searches the web for real-time information and should be your go-to resource. " +
        "Returns ranked web search results with titles, URLs, and content snippets.",
      inputSchema: searchWebSchema,
    },
    async (args: SearchWebArgs) => {
      try {
        const searchResponse = await searchPerplexity({
          query: args.query,
          max_results: args.max_results || 10,
          max_tokens_per_page: 1024,
          ...(args.country && { country: args.country }),
        });

        const formattedResults = formatSearchResultsAsMarkdown(searchResponse);

        return getToolResultSuccess({
          results: searchResponse.results,
          formatted: formattedResults,
        });
      } catch (error) {
        console.error("Error searching the web:", error);
        return getToolResultError(
          error instanceof Error ? `Search failed: ${error.message}` : "Failed to search the web",
        );
      }
    },
  );
}
