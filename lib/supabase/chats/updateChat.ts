import supabase from "@/lib/supabase/serverClient";
import type { TablesUpdate } from "@/types/database.types";

/**
 * Applies a partial update to a `chats` row.
 *
 * @param chatId - Chat id.
 * @param patch - Fields to merge (non-null columns only).
 * @returns `true` when Supabase reports no error; `false` after logging otherwise.
 */
export async function updateChat(chatId: string, patch: TablesUpdate<"chats">): Promise<boolean> {
  const { error } = await supabase.from("chats").update(patch).eq("id", chatId);

  if (error) {
    console.error("[updateChat] error:", error);
    return false;
  }

  return true;
}
