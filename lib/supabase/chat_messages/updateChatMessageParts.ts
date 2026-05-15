import supabase from "@/lib/supabase/serverClient";
import type { Json } from "@/types/database.types";

/**
 * Updates only `parts` on an existing `chat_messages` row.
 *
 * @param id - Message id.
 * @param parts - Serialized UI message parts (JSON).
 * @returns `true` on success; `false` after logging on Supabase error.
 */
export async function updateChatMessageParts(id: string, parts: Json): Promise<boolean> {
  const { error } = await supabase.from("chat_messages").update({ parts }).eq("id", id);

  if (error) {
    console.error("[updateChatMessageParts] error:", error);
    return false;
  }

  return true;
}
