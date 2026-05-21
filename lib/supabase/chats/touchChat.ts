import supabase from "@/lib/supabase/serverClient";

/**
 * Bumps a chat's `updated_at` timestamp to mark it as recently active.
 * Used by the chat workflow handler before starting a stream so the chat
 * sidebar / sorting reflects current activity.
 *
 * Failures are logged and swallowed — touching is best-effort and never
 * blocks the request path.
 *
 * @param chatId - The chat id to touch.
 * @param activityAt - Timestamp to write (defaults to now).
 */
export async function touchChat(chatId: string, activityAt: Date = new Date()): Promise<void> {
  const { error } = await supabase
    .from("chats")
    .update({ updated_at: activityAt.toISOString() })
    .eq("id", chatId);

  if (error) {
    console.error("[touchChat] error:", error);
  }
}
