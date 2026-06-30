import supabase from "../serverClient";

/**
 * Counts the **delivered, non-empty** emails recorded for a chat/run in
 * `email_send_log` (status = 'sent'). Used to verify that a task which was
 * supposed to email actually delivered one. Returns 0 on error.
 *
 * @param chatId - The chat/run id (email_send_log.chat_id).
 * @returns The number of 'sent' rows for the chat.
 */
export async function countDeliveredEmails(chatId: string): Promise<number> {
  const { count, error } = await supabase
    .from("email_send_log")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId)
    .eq("status", "sent");

  if (error) return 0;
  return count ?? 0;
}
