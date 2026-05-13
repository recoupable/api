import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Returns `chat_reads` rows for the given account scoped to the chat id list.
 * Empty `chatIds` yields `[]` without querying.
 *
 * @param accountId - Authenticated workspace account id.
 * @param chatIds - Chat ids to load read cursors for (typically one session).
 * @returns Matching rows, or [] on Supabase error (logged).
 */
export async function selectChatReadsByAccountAndChatIds(
  accountId: string,
  chatIds: string[],
): Promise<Tables<"chat_reads">[]> {
  if (chatIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("chat_reads")
    .select("*")
    .eq("account_id", accountId)
    .in("chat_id", chatIds);

  if (error) {
    console.error("[selectChatReadsByAccountAndChatIds] error:", error);
    return [];
  }

  return data ?? [];
}
