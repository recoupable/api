import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/** Optional filters for a generic `email_send_log` read. */
export interface SelectEmailSendLogFilters {
  /** Exact match on `account_id` — for per-account dedup checks. */
  accountId?: string;
  /** Exact match on `status` (e.g. "sent"). */
  status?: string;
  /** Substring matched within `raw_body` (LIKE `%value%`) — pass the marker the send was keyed on. */
  rawBodyLike?: string;
  /** Cap the number of rows returned. */
  limit?: number;
}

/**
 * Generic read of `email_send_log` with optional filters — reused for any
 * email-type idempotency/dedup check (pass the `raw_body` marker the send was
 * keyed on). KISS: one query builder instead of a per-email-type select.
 *
 * @param filters - Optional status / raw_body-substring / limit filters
 * @returns Matching rows (empty array on error or no match)
 */
export async function selectEmailSendLog(
  filters: SelectEmailSendLogFilters = {},
): Promise<Tables<"email_send_log">[]> {
  let query = supabase.from("email_send_log").select("*");

  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.rawBodyLike) query = query.like("raw_body", `%${filters.rawBodyLike}%`);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching email_send_log:", error);
    return [];
  }
  return data ?? [];
}
