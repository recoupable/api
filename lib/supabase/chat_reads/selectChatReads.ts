import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectChatReadsFilter {
  /** Required account filter — reads are always scoped to a single account. */
  accountId: string;
  /** Optional list of chat ids to narrow the result set. */
  chatIds?: string[];
}

/**
 * Reads rows from `chat_reads` for a single account. Used to derive
 * per-account unread state on chat lists. Returns `[]` on error
 * after logging.
 *
 * @param filter - Required account, optional chat-id list.
 * @returns Matching rows, or `[]` on error / no match.
 */
export async function selectChatReads(
  filter: SelectChatReadsFilter,
): Promise<Tables<"chat_reads">[]> {
  let query = supabase.from("chat_reads").select("*").eq("account_id", filter.accountId);

  if (filter.chatIds && filter.chatIds.length > 0) {
    query = query.in("chat_id", filter.chatIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[selectChatReads] error:", error);
    return [];
  }
  return data ?? [];
}
