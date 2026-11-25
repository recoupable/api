import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { artistSocialsScrapeBodySchema } from "@/lib/artist/validateArtistSocialsScrapeBody";
import { executeQuotedSocialRefresh } from "./executeQuotedSocialRefresh";
import { runArtistSocialsScrape } from "@/lib/artist/runArtistSocialsScrape";

const scrapeArtistSocialsSchema = artistSocialsScrapeBodySchema.extend({
  approved_quote: z
    .string()
    .min(1)
    .max(256)
    .optional()
    .describe(
      "Omit to preview the maximum charge. Pass the returned quote only after the user explicitly approves that amount.",
    ),
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
      title: "Refresh Artist Social Profiles",
      description:
        "Refresh public profile stats and recent posts for an artist you can access. The first call quotes the maximum at $0.05 per profile plus $0.01 per requested post. After explicit approval, pass the quote to start the refresh and receive run IDs; Recoup saves collected posts and charges only for profiles whose jobs start.",
      inputSchema: scrapeArtistSocialsSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
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
          execute: params =>
            executeQuotedSocialRefresh(params, args.artist_account_id, args.approved_quote),
        });
        if (result.kind === "quote") {
          return getToolResultSuccess({
            success: true,
            approval_required: true,
            quote: result.token,
            expires_at: new Date(result.expiresAt).toISOString(),
            profile_count: result.profileCount,
            maximum_credits: result.maximumCredits,
            maximum_usd: result.maximumUsd,
          });
        }
        if (result.kind === "invalid_quote") {
          return getToolResultError(
            "This quote expired or its scope changed. Preview the current charge again.",
          );
        }
        if (result.kind === "used_quote") {
          return getToolResultError(
            "This quote was already used. Check any runs from the original request.",
          );
        }
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
        // Credits are charged only for started runs, so an all-failed batch cost nothing.
        if (!result.runs.some(run => run.runId)) {
          const reasons = result.runs.map(run => run.error ?? "Unknown error").join("; ");
          return getToolResultError(`No scrape runs started: ${reasons}. No credits were charged.`);
        }
        return getToolResultSuccess({ success: true, runs: result.runs });
      } catch (err) {
        console.error("[scrape_artist_socials] failed:", err);
        return getToolResultError("Failed to start the artist socials scrape.");
      }
    },
  );
}
