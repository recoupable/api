import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";
import { upsertApifyScraperRuns } from "@/lib/supabase/apify_scraper_runs/upsertApifyScraperRuns";
import type { ApifyScrapeOrigin } from "@/lib/apify/types";

type RegisterSpawnedApifyRunParams = {
  runId: string;
  parentRunId: string;
  origin: ApifyScrapeOrigin;
  platform: string;
};

/**
 * Records a run that a webhook handler started (comments run, commenter
 * batch) in `apify_scraper_runs` with its parent, inheriting the parent's
 * account and social so every run in a chain is attributable to the scrape
 * that paid for it (app#2018). An unregistered parent — a chain rooted
 * before lineage shipped — still registers the child, with no account.
 *
 * Bookkeeping only: never throws, so a database hiccup cannot fail the
 * webhook that already persisted the run's results.
 */
export async function registerSpawnedApifyRun({
  runId,
  parentRunId,
  origin,
  platform,
}: RegisterSpawnedApifyRunParams): Promise<void> {
  try {
    const [parent] = await selectApifyScraperRun({ runId: parentRunId });
    await upsertApifyScraperRuns([
      {
        run_id: runId,
        parent_run_id: parentRunId,
        origin,
        platform,
        account_id: parent?.account_id ?? null,
        social_id: parent?.social_id ?? null,
      },
    ]);
  } catch (error) {
    console.error("[WARN] registerSpawnedApifyRun failed:", error);
  }
}
