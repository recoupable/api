import { scrapeProfileUrlBatch } from "@/lib/apify/scrapeProfileUrlBatch";
import type { AccountSocialWithSocial } from "@/lib/supabase/account_socials/selectAccountSocials";
import { deductSocialScrapeCredits } from "@/lib/socials/deductSocialScrapeCredits";
import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";

export interface StartArtistSocialsScrapeParams {
  /** The authenticated account that pays for and owns the scrape runs. */
  accountId: string;
  /** The artist's linked socials, already access-checked by the caller. */
  socials: AccountSocialWithSocial[];
  /** Recent-posts depth forwarded to each platform scraper. */
  posts?: number;
  /** Per-profile credit cost, already gated by the caller. */
  costPerProfile: number;
  /** Usage-event label for the charge (route pattern or MCP tool name). */
  modelId: string;
}

export interface StartedArtistSocialsScrape {
  runId: string | null;
  datasetId: string | null;
  error: string | null;
}

/**
 * Starts one Apify scrape per linked artist social, charges credits for the
 * profiles whose scrape actually started, and registers the started runs as
 * one batch so webhook completions assemble a single new-posts digest
 * (chat#1855). Shared by `POST /api/artist/socials/scrape` and the
 * `scrape_artist_socials` MCP tool. Access and the up-front credit gate stay
 * with the caller, whose response shapes differ.
 *
 * @param params - See {@link StartArtistSocialsScrapeParams}.
 * @returns One `{ runId, datasetId, error }` entry per scraped profile.
 */
export async function startArtistSocialsScrape({
  accountId,
  socials,
  posts,
  costPerProfile,
  modelId,
}: StartArtistSocialsScrapeParams): Promise<StartedArtistSocialsScrape[]> {
  const results = await scrapeProfileUrlBatch(
    socials.map(social => ({
      profileUrl: social.social?.profile_url,
      username: social.social?.username,
    })),
    posts,
  );

  const started = results.filter(result => result.state === "started");
  if (started.length) {
    await deductSocialScrapeCredits(accountId, costPerProfile * started.length, modelId);

    // Registration failure must not fail the scrape.
    const batchId = crypto.randomUUID();
    const socialByUrl = new Map(
      socials.map(s => [s.social?.profile_url ?? "", s.social?.id ?? null]),
    );
    await upsertApifyScraperRuns(
      started.map(r => ({
        run_id: r.runId,
        account_id: accountId,
        social_id: r.profileUrl ? (socialByUrl.get(r.profileUrl) ?? null) : null,
        platform: r.profileUrl ? getSocialPlatformByLink(r.profileUrl).toLowerCase() : null,
        batch_id: batchId,
        origin: "artist",
      })),
    );
  }

  return results.map(({ runId, datasetId, error }) => ({ runId, datasetId, error }));
}
