import supabase from "@/lib/supabase/serverClient";
import type { Tables, TablesUpdate } from "@/types/database.types";

interface UpdateChatParams {
  chatId: string;
  patch: TablesUpdate<"chats">;
}

/**
 * Applies a partial update to the `chats` row identified by `chatId`.
 * `updated_at` is refreshed by the `set_updated_at` Postgres trigger.
 * Returns the updated row, or `null` if no row matches or Supabase
 * reports an error.
 *
 * @param params - The chat id and patch to apply.
 * @returns The updated row, or `null`.
 */
export async function updateChat({
  chatId,
  patch,
}: UpdateChatParams): Promise<Tables<"chats"> | null> {
  const { data, error } = await supabase
    .from("chats")
    .update(patch)
    .eq("id", chatId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Error updating chat:", error);
    return null;
  }

  return data;
}
