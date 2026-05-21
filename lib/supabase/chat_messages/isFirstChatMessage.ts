import supabase from "@/lib/supabase/serverClient";

/**
 * Returns true when the given `messageId` is the only persisted message in
 * the chat (i.e. the very first one). Used to decide whether to auto-title
 * the chat from the user's opening prompt.
 *
 * @param chatId - The chat to inspect.
 * @param messageId - The candidate "first" message id.
 * @returns true iff exactly one row exists for this chat AND its id matches.
 */
export async function isFirstChatMessage(chatId: string, messageId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(2);

  if (error) {
    console.error("[isFirstChatMessage] error:", error);
    return false;
  }

  return Array.isArray(data) && data.length === 1 && data[0]?.id === messageId;
}
