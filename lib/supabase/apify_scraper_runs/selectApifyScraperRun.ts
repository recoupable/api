import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/** Returns the registered scrape run for an Apify run id, or null. */
export async function selectApifyScraperRun(
  runId: string,
): Promise<Tables<"apify_scraper_runs"> | null> {
  const { data, error } = await supabase
    .from("apify_scraper_runs")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) {
    console.error("[ERROR] selectApifyScraperRun:", error);
    return null;
  }
  return data ?? null;
}
