import supabase from "@/lib/supabase/serverClient";
import type { ApifyScraperRunRow } from "@/lib/supabase/apify_scraper_runs/types";

/** Returns the registered scrape run for an Apify run id, or null. */
export async function selectApifyScraperRun(runId: string): Promise<ApifyScraperRunRow | null> {
  const { data, error } = await supabase
    .from("apify_scraper_runs" as never)
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) {
    console.error("[ERROR] selectApifyScraperRun:", error);
    return null;
  }
  return (data as ApifyScraperRunRow | null) ?? null;
}
