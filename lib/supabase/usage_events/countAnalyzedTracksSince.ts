import supabase from "@/lib/supabase/serverClient";

interface CountAnalyzedTracksSinceParams {
  accountId: string;
  /** Lower bound on `created_at` (ISO string), inclusive. */
  since: string;
}

/**
 * How many distinct tracks an account has analyzed with Music Flamingo since
 * `since`: distinct `resource_url` over the account's `provider = modal`
 * charges. `full_report` writes one row per section against one URL, so it
 * counts once; a repeat of the same track does not count again.
 *
 * Only called for capped plans, whose row counts are small.
 *
 * @param params - The account and the inclusive lower bound.
 * @returns Number of distinct audio URLs charged in the window.
 */
export async function countAnalyzedTracksSince(
  params: CountAnalyzedTracksSinceParams,
): Promise<number> {
  const { data, error } = await supabase
    .from("usage_events")
    .select("resource_url")
    .eq("account_id", params.accountId)
    .eq("provider", "modal")
    .gte("created_at", params.since)
    .not("resource_url", "is", null);

  if (error) {
    console.error("Error counting analyzed tracks:", error);
    throw error;
  }
  return new Set((data ?? []).map(row => row.resource_url)).size;
}
