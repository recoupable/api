import supabase from "@/lib/supabase/serverClient";

/**
 * Deletes the `chats` row identified by `chatId`. Returns `true` on
 * success and `false` on Supabase error after logging.
 *
 * @param chatId - The id of the chat to delete.
 * @returns `true` on success, `false` on error.
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  const { error } = await supabase.from("chats").delete().eq("id", chatId);

  if (error) {
    console.error("Error deleting chat:", error);
    return false;
  }

  return true;
}
