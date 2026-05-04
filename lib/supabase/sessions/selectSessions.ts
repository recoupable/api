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
 * to narrow the result set; an unset filter is ignored. Returns an
 * empty array on Supabase error after logging.
 *
 * Callers project to whatever shape they need (single row by id,
 * titles by account, etc.) — keeping this single function as the
 * sole entry point keeps `lib/supabase/sessions/` DRY.
 *
 * @param filter - Optional filters narrowing the query.
 * @returns Matching rows, or `[]` on error / no match.
 */
export async function selectSessions(
  filter: SelectSessionsFilter = {},
): Promise<Tables<"sessions">[]> {
  let query = supabase.from("sessions").select("*");
  if (filter.id) query = query.eq("id", filter.id);
  if (filter.accountId) query = query.eq("account_id", filter.accountId);

  try {
    const { data, error } = await query;
    if (error) {
      console.error("[selectSessions] error:", error);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.error("[selectSessions] threw:", e);
    return [];
  }
}
