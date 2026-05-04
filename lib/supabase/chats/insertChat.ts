import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Inserts a new row into the `chats` table and returns it.
 *
 * @param row - The chat row to insert.
 * @returns The inserted row, or `null` if the insert failed.
 */
export async function insertChat(row: TablesInsert<"chats">): Promise<Tables<"chats"> | null> {
  const { data, error } = await supabase.from("chats").insert(row).select().maybeSingle();

  if (error) {
    console.error("Error inserting chat:", error);
    return null;
  }

  return data;
}
