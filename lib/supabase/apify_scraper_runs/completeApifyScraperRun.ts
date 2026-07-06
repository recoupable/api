import supabase from "@/lib/supabase/serverClient";
import type { ApifyScraperRunRow } from "@/lib/supabase/apify_scraper_runs/types";

/**
 * Marks a scrape run's results as processed and records which post URLs were
 * genuinely new. Returns the updated row (carrying batch_id) or null when the
 * run was never registered (legacy/non-batch runs).
 */
export async function completeApifyScraperRun(
  runId: string,
  newPostUrls: string[],
): Promise<ApifyScraperRunRow | null> {
  const { data, error } = await supabase
    .from("apify_scraper_runs" as never)
    .update({ completed_at: new Date().toISOString(), new_post_urls: newPostUrls } as never)
    .eq("run_id", runId)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[ERROR] completeApifyScraperRun:", error);
    return null;
  }
  return (data as ApifyScraperRunRow | null) ?? null;
}
