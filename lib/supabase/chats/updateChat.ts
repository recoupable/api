import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Updates a `chats` row by id with any subset of mutable columns.
 * Returns the updated row, or null on Supabase error.
 *
 * @param id - The chat id to update.
 * @param updates - Partial column updates (any TablesUpdate<"chats"> shape).
 * @returns The updated row, or null on error.
 */
export async function updateChat(
  id: string,
  updates: TablesUpdate<"chats">,
): Promise<Tables<"chats"> | null> {
  const { data, error } = await supabase
    .from("chats")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateChat] error:", error);
    return null;
  }

  return data;
}
