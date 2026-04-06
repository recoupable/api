import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { proxyToChartmetric } from "@/lib/research/proxyToChartmetric";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { deductCredits } from "@/lib/credits/deductCredits";

const schema = z.object({});

/**
 * Registers the "research_festivals" tool on the MCP server.
 * Lists music festivals.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchFestivalsTool(server: McpServer): void {
  server.registerTool(
    "get_festivals",
    {
      description: "List music festivals.",
      inputSchema: schema,
    },
    async (_args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
      const authInfo = extra.authInfo as McpAuthInfo | undefined;
      const { accountId, error } = await resolveAccountId({
        authInfo,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Failed to resolve account ID");

      try {
        const result = await proxyToChartmetric("/festival/list");
        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess(result.data);
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch festivals",
        );
      }
    },
  );
}
