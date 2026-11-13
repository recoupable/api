import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { artistSocialsScrapeBodySchema } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { selectAccountSocials } from "@/lib/supabase/account_socials/selectAccountSocials";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { startArtistSocialsScrape } from "@/lib/artist/startArtistSocialsScrape";

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
        if (!(await checkAccountArtistAccess(accountId, args.artist_account_id))) {
          return getToolResultError("Access denied to specified artist_account_id");
        }

        const socials = await selectAccountSocials({ accountId: args.artist_account_id });
        if (!socials.length) {
          return getToolResultSuccess({
            success: true,
            runs: [],
            message: "This artist has no linked social profiles to scrape.",
          });
        }

        const costPerProfile = getSocialScrapeCreditCost(args.posts);
        const gate = await checkCreditsAvailable({
          accountId,
          creditsToDeduct: costPerProfile * socials.length,
        });
        if (gate.kind === "insufficient_credits") {
          return getToolResultError(
            `Insufficient credits: ${gate.remainingCredits} remaining, ${gate.requiredCredits} required`,
          );
        }

        const runs = await startArtistSocialsScrape({
          accountId,
          socials,
          posts: args.posts,
          costPerProfile,
          // Same usage label as the REST route: one billed operation groups under one
          // documented `METHOD /route/pattern` value whatever the transport.
          modelId: "POST /api/artist/socials/scrape",
        });
        return getToolResultSuccess({ success: true, runs });
      } catch (err) {
        console.error("[scrape_artist_socials] failed:", err);
        return getToolResultError("Failed to start the artist socials scrape.");
      }
    },
  );
}
