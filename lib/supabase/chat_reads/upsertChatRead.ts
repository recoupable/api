import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Upserts a `chat_reads` row for the given account and chat, setting
 * `last_read_at` to the current time. Idempotent — safe to call repeatedly.
 *
 * @param accountId - The owning account id.
 * @param chatId - The chat id to mark as read.
 * @returns The upserted row, or `null` if the write failed.
 */
export async function upsertChatRead(
  accountId: string,
  chatId: string,
): Promise<Tables<"chat_reads"> | null> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("chat_reads")
    .upsert(
      {
        account_id: accountId,
        chat_id: chatId,
        last_read_at: now,
        updated_at: now,
      },
      { onConflict: "account_id,chat_id" },
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("[upsertChatRead] error:", error);
    return null;
  }

  return data;
}
