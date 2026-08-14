import supabase from "@/lib/supabase/serverClient";
import type { TablesInsert } from "@/types/database.types";

/**
 * Records scrape runs at start time so per-platform webhook completions can
 * find their digest-batch siblings (recoupable/chat#1855).
 *
 * @param runs - One row per started Apify run (run_id, account_id, batch_id, …).
 */
export async function upsertApifyScraperRuns(runs: TablesInsert<"apify_scraper_runs">[]) {
  if (!runs.length) return { data: null, error: null };
  const { data, error } = await supabase
    .from("apify_scraper_runs")
    .upsert(runs, { onConflict: "run_id", ignoreDuplicates: true });
  if (error) console.error("[ERROR] upsertApifyScraperRuns:", error);
  return { data, error };
}
