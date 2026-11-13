import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { artistSocialsScrapeBodySchema } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { runArtistSocialsScrape } from "@/lib/artist/runArtistSocialsScrape";

const scrapeArtistSocialsSchema = artistSocialsScrapeBodySchema.extend({
  artist_account_id: artistSocialsScrapeBodySchema.shape.artist_account_id.describe(
    "The artist account ID whose linked social profiles should be scraped.",
  ),
  posts: artistSocialsScrapeBodySchema.shape.posts.describe(
    "Optional number of recent posts (1-100) to fetch per profile. Each requested post adds to the credit cost.",
  ),
});

type ScrapeArtistSocialsArgs = z.infer<typeof scrapeArtistSocialsSchema>;

/**
 * Registers the "scrape_artist_socials" tool, the MCP counterpart of
 * `POST /api/artist/socials/scrape`. Starts a fresh scrape of every social
 * profile linked to the artist and returns one Apify run per profile; read
 * each run with `get_scraper_results`. Costs credits per profile started.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerScrapeArtistSocialsTool(server: McpServer): void {
  server.registerTool(
    "scrape_artist_socials",
    {
      description:
        "Start a fresh scrape of every social profile linked to an artist (profile stats and recent posts). Returns one run per profile with a runId; pass each runId to get_scraper_results to check status and read the scraped data. Scraped posts are also saved and can be listed later with get_artist_posts. Costs credits: $0.05 per profile plus $0.01 per requested post.",
      inputSchema: scrapeArtistSocialsSchema,
    },
    async (
      args: ScrapeArtistSocialsArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
    ) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error) return getToolResultError(error);
      if (!accountId) return getToolResultError("Authentication required.");

      try {
        const result = await runArtistSocialsScrape({
          accountId,
          artistAccountId: args.artist_account_id,
          posts: args.posts,
        });
        if (result.kind === "forbidden") {
          return getToolResultError("Access denied to specified artist_account_id");
        }
        if (result.kind === "insufficient_credits") {
          return getToolResultError(
            `Insufficient credits: ${result.remainingCredits} remaining, ${result.requiredCredits} required`,
          );
        }
        if (!result.runs.length) {
          return getToolResultSuccess({
            success: true,
            runs: [],
            message: "This artist has no linked social profiles to scrape.",
          });
        }
        return getToolResultSuccess({ success: true, runs: result.runs });
      } catch (err) {
        console.error("[scrape_artist_socials] failed:", err);
        return getToolResultError("Failed to start the artist socials scrape.");
      }
    },
  );
}
