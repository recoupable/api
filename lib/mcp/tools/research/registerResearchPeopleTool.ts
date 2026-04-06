import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { searchPeople } from "@/lib/exa/searchPeople";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({
  query: z.string().describe("Search query for people"),
  num_results: z
    .number()
    .optional()
    .default(10)
    .describe("Number of results to return (default: 10)"),
});

/**
 * Registers the "research_people" tool on the MCP server.
 * Searches for people in the music industry using Exa's people index.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchPeopleTool(server: McpServer): void {
  server.registerTool(
    "find_industry_people",
    {
      description:
        "Search for people in the music industry — artists, managers, A&R reps, producers. " +
        "Returns profiles with LinkedIn data and summaries.",
      inputSchema: schema,
    },
    async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      try {
        const result = await searchPeople(args.query, args.num_results ?? 10);
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess(result);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to search for people",
        );
      }
    },
  );
}
