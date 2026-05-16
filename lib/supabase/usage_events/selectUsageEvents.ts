import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectUsageEventsParams {
  accountId?: string;
  /** Lower bound on `created_at` (ISO string). Omit to fetch all-time. */
  createdAfter?: string;
  /** Inclusive zero-indexed range start. */
  from: number;
  /** Inclusive zero-indexed range end. */
  to: number;
}

/**
 * Selects a single inclusive range of `usage_events` rows ordered by
 * `created_at` DESC with `id` DESC as a deterministic tiebreaker.
 *
 * @param params - Filters + range bounds.
 * @returns Matching usage_events rows for the range.
 */
export async function selectUsageEvents(
  params: SelectUsageEventsParams,
): Promise<Tables<"usage_events">[]> {
  let query = supabase
    .from("usage_events")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(params.from, params.to);

  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.createdAfter) query = query.gte("created_at", params.createdAfter);

  const { data, error } = await query;
  if (error) {
    console.error("Error selecting usage_events:", error);
    throw error;
  }
  return data ?? [];
}
