import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectSessionsFilter {
  /** Optional id filter — when set, returns at most one row. */
  id?: string;
  /** Optional account filter — when set, returns every session owned by the account. */
  accountId?: string;
}

/**
 * General-purpose `sessions` reader. Pass any combination of filters
 * to narrow the result set; an unset filter is ignored.
 *
 * Returns `null` on Supabase error (DB unreachable / query failure) so
 * callers can distinguish a transient backend failure from a legitimately
 * empty result set. Returns `[]` when the query succeeds but matches no
 * rows.
 *
 * Callers project to whatever shape they need (single row by id,
 * titles by account, etc.) — keeping this single function as the
 * sole entry point keeps `lib/supabase/sessions/` DRY.
 *
 * @param filter - Optional filters narrowing the query.
 * @returns Matching rows, `[]` on no match, or `null` on DB error.
 */
export async function selectSessions(
  filter: SelectSessionsFilter = {},
): Promise<Tables<"sessions">[] | null> {
  let query = supabase.from("sessions").select("*");
  if (filter.id) query = query.eq("id", filter.id);
  if (filter.accountId) query = query.eq("account_id", filter.accountId);

  try {
    const { data, error } = await query;
    if (error) {
      console.error("[selectSessions] error:", error);
      return null;
    }
    return data ?? [];
  } catch (e) {
    console.error("[selectSessions] threw:", e);
    return null;
  }
}
