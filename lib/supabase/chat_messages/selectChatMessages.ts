import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

export type SelectChatMessagesFilter = {
  id?: string;
  chatId?: string;
  /** Order by `created_at` direction. Defaults to ascending (oldest first). */
  orderBy?: { createdAt: "asc" | "desc" };
  /** Maximum rows to return. Omit for no limit. */
  limit?: number;
};

/**
 * Generic `chat_messages` reader mirroring the `selectChats` / `selectSessions`
 * pattern. Returns rows on success, `[]` on no match, or `null` on Supabase
 * error so callers can distinguish "nothing here" from "DB unreachable".
 *
 * Domain-specific questions ("is this the first message in the chat?") live
 * in wrapper helpers under `lib/chat/` — keep this file focused on the
 * read primitive.
 */
export async function selectChatMessages(
  filter: SelectChatMessagesFilter = {},
): Promise<Tables<"chat_messages">[] | null> {
  let query = supabase.from("chat_messages").select("*");
  if (filter.id) query = query.eq("id", filter.id);
  if (filter.chatId) query = query.eq("chat_id", filter.chatId);
  if (filter.orderBy) {
    query = query.order("created_at", { ascending: filter.orderBy.createdAt === "asc" });
    query = query.order("id", { ascending: true });
  }
  if (filter.limit !== undefined) query = query.limit(filter.limit);

  const { data, error } = await query;
  if (error) {
    console.error("[selectChatMessages] error:", error);
    return null;
  }
  return data ?? [];
}
