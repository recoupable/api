import supabase from "@/lib/supabase/serverClient";

interface CountUsageEventsParams {
  accountId?: string;
  /** Lower bound on `created_at` (ISO string). Omit to count all-time. */
  createdAfter?: string;
}

/**
 * Counts `usage_events` rows matching the given filters.
 *
 * @param params - Optional filters.
 * @returns Total row count.
 */
export async function countUsageEvents(params: CountUsageEventsParams = {}): Promise<number> {
  let query = supabase.from("usage_events").select("id", { count: "exact", head: true });

  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.createdAfter) query = query.gte("created_at", params.createdAfter);

  const { count, error } = await query;
  if (error) {
    console.error("Error counting usage_events:", error);
    throw error;
  }
  return count ?? 0;
}
