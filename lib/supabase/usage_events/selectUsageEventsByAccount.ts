import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectUsageEventsByAccountParams {
  accountId: string;
  /** Inclusive lower bound on `created_at` (ISO string). */
  from: string;
  /** Exclusive upper bound on `created_at` (ISO string). */
  to: string;
  /** Items strictly older than this `created_at` (ISO string) are returned. */
  cursor?: string;
  limit: number;
}

/**
 * Selects one page of an account's `usage_events` within a period, newest
 * first. Keyset pagination on `created_at`: pass the last item's `created_at`
 * as `cursor` to fetch the next page.
 *
 * @param params - Account, period bounds, optional cursor and page size.
 * @returns Matching rows, newest first.
 */
export async function selectUsageEventsByAccount(
  params: SelectUsageEventsByAccountParams,
): Promise<Tables<"usage_events">[]> {
  let query = supabase
    .from("usage_events")
    .select("*")
    .eq("account_id", params.accountId)
    .gte("created_at", params.from)
    .lt("created_at", params.to);

  if (params.cursor) query = query.lt("created_at", params.cursor);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(params.limit);
  if (error) {
    console.error("Error selecting usage_events by account:", error);
    throw error;
  }
  return data ?? [];
}
