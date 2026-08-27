import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";
import { getSocialPlatformByLink } from "@/lib/artists/getSocialPlatformByLink";

type RegisterRootApifyRunParams = {
  runId: string;
  accountId: string;
  socialId: string;
  profileUrl: string;
};

/**
 * Registers the run a scrape endpoint started — the root of a run chain —
 * so the comments and commenter runs it spawns can inherit its account and
 * social through `parent_run_id` (app#2018). Registration failure is
 * logged by the upsert and never fails the scrape.
 */
export async function registerRootApifyRun({
  runId,
  accountId,
  socialId,
  profileUrl,
}: RegisterRootApifyRunParams): Promise<void> {
  await upsertApifyScraperRuns([
    {
      run_id: runId,
      account_id: accountId,
      social_id: socialId,
      platform: getSocialPlatformByLink(profileUrl).toLowerCase(),
      origin: "artist",
    },
  ]);
}
