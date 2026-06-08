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
 * `selectSessions` pattern. Returns [] on Supabase error after logging.
 *
 * @param filter - Optional filters narrowing the query.
 * @returns Matching chat rows, or [] on error / no match.
 */
export async function selectChats(filter: SelectChatsFilter = {}): Promise<Tables<"chats">[]> {
  let query = supabase.from("chats").select("*");
  if (filter.id) query = query.eq("id", filter.id);
  if (filter.sessionId) query = query.eq("session_id", filter.sessionId);

  const { data, error } = await query;
  if (error) {
    console.error("[selectChats] error:", error);
    return [];
  }
  return data ?? [];
}
