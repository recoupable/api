import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

interface SelectChatMessagesFilter {
  chatId: string;
}

/**
 * Returns every `chat_messages` row for the given chat ordered by
 * `created_at` ascending (ties broken by `id` for deterministic
 * playback). Returns [] on Supabase error after logging.
 *
 * @param filter - The chat id to scope the query to.
 * @returns Matching message rows, or [] on error / no match.
 */
export async function selectChatMessages({
  chatId,
}: SelectChatMessagesFilter): Promise<Tables<"chat_messages">[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("[selectChatMessages] error:", error);
    return [];
  }
  return data ?? [];
}
