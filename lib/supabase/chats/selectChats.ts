import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectChatsFilter {
  /** Optional id filter — when set, returns at most one row. */
  id?: string;
  /** Optional session filter — when set, returns every chat in the session. */
  sessionId?: string;
}

/**
 * General-purpose `chats` reader. Pass any combination of filters to
 * narrow the result set; an unset filter is ignored. Mirrors the
 * `selectSessions` pattern.
 *
 * Returns `null` on Supabase error (DB unreachable / query failure) so
 * callers can distinguish a transient backend failure from a legitimately
 * empty result set. Returns `[]` when the query succeeds but matches no rows.
 *
 * @param filter - Optional filters narrowing the query.
 * @returns Matching chat rows, `[]` on no match, or `null` on DB error.
 */
export async function selectChats(
  filter: SelectChatsFilter = {},
): Promise<Tables<"chats">[] | null> {
  let query = supabase.from("chats").select("*");
  if (filter.id) query = query.eq("id", filter.id);
  if (filter.sessionId) query = query.eq("session_id", filter.sessionId);

  const { data, error } = await query;
  if (error) {
    console.error("[selectChats] error:", error);
    return null;
  }
  return data ?? [];
}
