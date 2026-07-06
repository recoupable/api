import supabase from "@/lib/supabase/serverClient";
import type { ApifyScraperRunRow } from "@/lib/supabase/apify_scraper_runs/types";

/**
 * Records scrape runs at start time so per-platform webhook completions can
 * find their digest-batch siblings (recoupable/chat#1855).
 *
 * @param runs - One row per started Apify run (run_id, account_id, batch_id, …).
 */
export async function insertApifyScraperRuns(
  runs: Pick<ApifyScraperRunRow, "run_id" | "account_id" | "social_id" | "platform" | "batch_id">[],
) {
  if (!runs.length) return { data: null, error: null };
  const { data, error } = await supabase
    .from("apify_scraper_runs" as never)
    .upsert(runs as never[], { onConflict: "run_id", ignoreDuplicates: true });
  if (error) console.error("[ERROR] insertApifyScraperRuns:", error);
  return { data, error };
}
