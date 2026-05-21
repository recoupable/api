import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Insert-only message persistence with conflict ignore on `id`. Used by the
 * chat workflow handler to fire-and-forget the latest user message before the
 * workflow starts — clients may resend the same message id and we want the
 * second insert to be a silent no-op rather than an error.
 *
 * @param data - The message row to insert.
 * @returns The inserted row, or null if the id already existed or on DB error.
 */
export async function createChatMessageIfNotExists(
  data: TablesInsert<"chat_messages">,
): Promise<Tables<"chat_messages"> | null> {
  const { data: row, error } = await supabase
    .from("chat_messages")
    .upsert(data, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) {
    console.error("[createChatMessageIfNotExists] error:", error);
    return null;
  }

  return row;
}
