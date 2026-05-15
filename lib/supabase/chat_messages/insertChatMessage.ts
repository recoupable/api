import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts a `chat_messages` row.
 *
 * @param row - Insert payload (`id`, `chat_id`, `role`, `parts`).
 * @returns The inserted row, or `null` after logging on failure.
 */
export async function insertChatMessage(
  row: TablesInsert<"chat_messages">,
): Promise<Tables<"chat_messages"> | null> {
  const { data, error } = await supabase.from("chat_messages").insert(row).select().maybeSingle();

  if (error) {
    console.error("[insertChatMessage] error:", error);
    return null;
  }

  return data ?? null;
}
