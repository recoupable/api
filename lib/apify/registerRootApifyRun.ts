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
 * social through `parent_run_id` (app#2018). Bookkeeping only: never
 * throws, so a database hiccup cannot 500 a scrape that already started
 * and charged credits.
 */
export async function registerRootApifyRun({
  runId,
  accountId,
  socialId,
  profileUrl,
}: RegisterRootApifyRunParams): Promise<void> {
  try {
    await upsertApifyScraperRuns([
      {
        run_id: runId,
        account_id: accountId,
        social_id: socialId,
        platform: getSocialPlatformByLink(profileUrl.toLowerCase()).toLowerCase(),
        origin: "artist",
      },
    ]);
  } catch (error) {
    console.error("[WARN] registerRootApifyRun failed:", error);
  }
}
