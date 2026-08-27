import supabase from "@/lib/supabase/serverClient";

type CountApifyScraperRunsForAccountParams = {
  accountId: string;
  /** ISO timestamp; only runs created at or after it are counted. */
  since: string;
};

/**
 * Number of Apify runs registered to an account since a point in time —
 * roots and spawned runs alike (spawned runs inherit the root's account).
 */
export async function countApifyScraperRunsForAccount({
  accountId,
  since,
}: CountApifyScraperRunsForAccountParams): Promise<number> {
  const { count, error } = await supabase
    .from("apify_scraper_runs")
    .select("run_id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .gte("created_at", since);
  if (error) {
    console.error("[ERROR] countApifyScraperRunsForAccount:", error);
    throw error;
  }
  return count ?? 0;
}
