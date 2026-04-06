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
 * Registers the "research_radio" tool on the MCP server.
 * Returns the list of radio stations tracked by Chartmetric.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerResearchRadioTool(server: McpServer): void {
  server.registerTool(
    "get_radio_stations",
    {
      description:
        "List radio stations tracked by Chartmetric. " +
        "Returns station names, formats, and markets.",
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
        const result = await proxyToChartmetric("/radio/station-list");
        if (result.status !== 200) {
          return getToolResultError(`Request failed with status ${result.status}`);
        }
        const stations = Array.isArray(result.data) ? result.data : [];
        try {
          await deductCredits({ accountId, creditsToDeduct: 5 });
        } catch {
          // Credit deduction failed but data was fetched — don't block
        }
        return getToolResultSuccess({ stations });
      } catch (error) {
        return getToolResultError(
          error instanceof Error ? error.message : "Failed to fetch radio stations",
        );
      }
    },
  );
}
