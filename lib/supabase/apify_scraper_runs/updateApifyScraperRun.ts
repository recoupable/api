import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Claims a scrape run's completion: marks results processed and records which
 * post URLs were genuinely new. The `completed_at IS NULL` guard makes the
 * claim idempotent — an Apify webhook retry for an already-completed run
 * returns null (so it can never re-trigger digest assembly or overwrite the
 * recorded diff) exactly like a never-registered legacy run.
 */
export async function updateApifyScraperRun(
  runId: string,
  newPostUrls: string[],
): Promise<Tables<"apify_scraper_runs"> | null> {
  const { data, error } = await supabase
    .from("apify_scraper_runs")
    .update({ completed_at: new Date().toISOString(), new_post_urls: newPostUrls })
    .eq("run_id", runId)
    .is("completed_at", null)
    .select()
    .maybeSingle();
  if (error) {
    console.error("[ERROR] updateApifyScraperRun:", error);
    return null;
  }
  return data ?? null;
}
