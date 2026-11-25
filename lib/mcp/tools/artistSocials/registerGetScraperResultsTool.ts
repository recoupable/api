import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getScraperResultsParamsSchema } from "@/lib/apify/validateGetScraperResultsRequest";
import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";
import { projectPublicScrapeResults } from "./projectPublicScrapeResults";
import { getScraperRunResults } from "@/lib/apify/getScraperRunResults";

const getScraperResultsSchema = getScraperResultsParamsSchema.extend({
  runId: getScraperResultsParamsSchema.shape.runId.describe(
    "The runId returned by scrape_artist_socials.",
  ),
});

type GetScraperResultsArgs = z.infer<typeof getScraperResultsSchema>;

/**
 * Registers the account-scoped MCP lookup for previously started artist refreshes.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerGetScraperResultsTool(server: McpServer): void {
  server.registerTool(
    "get_scraper_results",
    {
      title: "Get Artist Social Refresh Results",
      description:
        "Check a social refresh started by your connected Recoup account. Pass a run ID from scrape_artist_socials. When the refresh succeeds, returns available public profile and post links and aggregate engagement counts.",
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
        const [run] = await selectApifyScraperRun({ runId: args.runId });
        if (run?.account_id !== accountId || run.origin !== "artist" || !run.batch_id) {
          return getToolResultError("Artist social refresh run not found.");
        }
        const { status, data } = await getScraperRunResults(args.runId);
        return getToolResultSuccess({
          status,
          ...(data ? { data: projectPublicScrapeResults(data) } : {}),
        });
      } catch (err) {
        console.error("[get_scraper_results] failed:", err);
        return getToolResultError("Failed to read the scrape run.");
      }
    },
  );
}
