import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectUsageEventsParams {
  accountId?: string;
  /** Lower bound on `created_at` (ISO string), inclusive. Omit for all-time. */
  createdAfter?: string;
  /** Upper bound on `created_at` (ISO string), exclusive. Omit for no bound. */
  createdBefore?: string;
  /** Sort column, descending; `id` desc breaks ties either way. Default `created_at`. */
  orderBy?: "created_at" | "credits_deducted";
  /** Keyset for cost paging: rows strictly after this `(credits_deducted, id)` pair. */
  costBefore?: { creditsDeducted: number; id: string };
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
    .order(params.orderBy ?? "created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(params.from, params.to);

  if (params.accountId) query = query.eq("account_id", params.accountId);
  if (params.createdAfter) query = query.gte("created_at", params.createdAfter);
  if (params.createdBefore) query = query.lt("created_at", params.createdBefore);
  if (params.costBefore) {
    const { creditsDeducted, id } = params.costBefore;
    query = query.or(
      `credits_deducted.lt.${creditsDeducted},and(credits_deducted.eq.${creditsDeducted},id.lt.${id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error selecting usage_events:", error);
    throw error;
  }
  return data ?? [];
}
