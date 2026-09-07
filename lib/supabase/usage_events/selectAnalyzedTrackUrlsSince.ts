import supabase from "@/lib/supabase/serverClient";

interface SelectAnalyzedTrackUrlsSinceParams {
  accountId: string;
  /** Lower bound on `created_at` (ISO string), inclusive. */
  since: string;
}

/**
 * The distinct tracks an account has analyzed with Music Flamingo since
 * `since`: distinct `resource_url` over the account's `provider = modal`
 * charges. `full_report` writes one row per section against one URL, so a
 * track appears once however many calls it took.
 *
 * Only called for capped plans, whose row counts are small.
 *
 * @param params - The account and the inclusive lower bound.
 * @returns Distinct audio URLs charged in the window, in first-seen order.
 */
export async function selectAnalyzedTrackUrlsSince(
  params: SelectAnalyzedTrackUrlsSinceParams,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("usage_events")
    .select("resource_url")
    .eq("account_id", params.accountId)
    .eq("provider", "modal")
    .gte("created_at", params.since)
    .not("resource_url", "is", null);

  if (error) {
    console.error("Error selecting analyzed tracks:", error);
    throw error;
  }
  return [...new Set((data ?? []).map(row => row.resource_url as string))];
}
