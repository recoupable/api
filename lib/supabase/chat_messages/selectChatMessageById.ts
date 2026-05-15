import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Loads a single `chat_messages` row by primary key `id`.
 *
 * @param id - Message id (opaque string).
 * @returns The row, `null` when missing, or `null` after logging on Supabase error.
 */
export async function selectChatMessageById(id: string): Promise<Tables<"chat_messages"> | null> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[selectChatMessageById] error:", error);
    return null;
  }

  return data ?? null;
}
