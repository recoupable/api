import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getScraperResultsParamsSchema } from "@/lib/apify/validateGetScraperResultsRequest";
import { getScraperRunResults } from "@/lib/apify/getScraperRunResults";

const getScraperResultsSchema = getScraperResultsParamsSchema.extend({
  runId: getScraperResultsParamsSchema.shape.runId.describe(
    "The runId returned by scrape_artist_socials.",
  ),
});

type GetScraperResultsArgs = z.infer<typeof getScraperResultsSchema>;

/**
 * Registers the "get_scraper_results" tool, the MCP counterpart of
 * `GET /api/apify/runs/{runId}`. Like the REST route it requires any valid
 * credential but is not owner-scoped (chat#1840): datasets are public social
 * content and run ids are unguessable.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetScraperResultsTool(server: McpServer): void {
  server.registerTool(
    "get_scraper_results",
    {
      description:
        "Check a social scrape run started by scrape_artist_socials. Returns the run status (READY, RUNNING, SUCCEEDED, FAILED, ABORTED, TIMED-OUT) and, once SUCCEEDED, the scraped profile and post data. Call again later while the run is still RUNNING.",
      inputSchema: getScraperResultsSchema,
    },
    async (
      args: GetScraperResultsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Authentication required.");

      try {
        return getToolResultSuccess(await getScraperRunResults(args.runId));
      } catch (err) {
        console.error("[get_scraper_results] failed:", err);
        return getToolResultError("Failed to read the scrape run.");
      }
    },
  );
}
