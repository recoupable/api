import supabase from "@/lib/supabase/serverClient";

/**
 * Atomically swaps `chats.active_stream_id` only when the row's current value
 * matches `expectedStreamId`. Used by POST /api/chat/workflow to claim the
 * stream slot for a chat and resolve concurrent-request races.
 *
 * @param chatId - The chat id to update.
 * @param expectedStreamId - The value the row must currently hold. `null` means "currently unset".
 * @param nextStreamId - The new value to write. `null` clears the slot.
 * @returns true when exactly one row was updated, false otherwise (predicate mismatch or DB error).
 */
export async function compareAndSetChatActiveStreamId(
  chatId: string,
  expectedStreamId: string | null,
  nextStreamId: string | null,
): Promise<boolean> {
  const base = supabase.from("chats").update({ active_stream_id: nextStreamId }).eq("id", chatId);
  const predicated =
    expectedStreamId === null
      ? base.is("active_stream_id", null)
      : base.eq("active_stream_id", expectedStreamId);

  const { data, error } = await predicated.select("id");
  if (error) {
    console.error("[compareAndSetChatActiveStreamId] error:", error);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}
