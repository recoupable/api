import supabase from "@/lib/supabase/serverClient";
import type { ApifyScraperRunRow } from "@/lib/supabase/apify_scraper_runs/types";

/** Returns every scrape run registered under a digest batch. */
export async function selectApifyScraperRunsByBatch(
  batchId: string,
): Promise<ApifyScraperRunRow[]> {
  const { data, error } = await supabase
    .from("apify_scraper_runs" as never)
    .select("*")
    .eq("batch_id", batchId);
  if (error) {
    console.error("[ERROR] selectApifyScraperRunsByBatch:", error);
    return [];
  }
  return (data as ApifyScraperRunRow[] | null) ?? [];
}
