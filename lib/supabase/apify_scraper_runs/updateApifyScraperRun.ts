import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Marks a scrape run's results as processed and records which post URLs were
 * genuinely new. Returns the updated row (carrying batch_id) or null when the
 * run was never registered (legacy/non-batch runs).
 */
export async function updateApifyScraperRun(
  runId: string,
  newPostUrls: string[],
): Promise<Tables<"apify_scraper_runs"> | null> {
  const { data, error } = await supabase
    .from("apify_scraper_runs")
    .update({ completed_at: new Date().toISOString(), new_post_urls: newPostUrls })
    .eq("run_id", runId)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[ERROR] updateApifyScraperRun:", error);
    return null;
  }
  return data ?? null;
}
