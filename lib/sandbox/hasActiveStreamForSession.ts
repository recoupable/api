import { selectChats } from "@/lib/supabase/chats/selectChats";

/**
 * Checks whether any chat in the session has an `active_stream_id` set,
 * indicating an in-flight assistant stream.
 *
 * @param sessionId - The session to check.
 * @returns `true` when a stream is active, `false` when none are, `null` on DB failure.
 */
export async function hasActiveStreamForSession(
  sessionId: string,
): Promise<boolean | null> {
  const chats = await selectChats({ sessionId });
  if (chats === null) {
    return null;
  }

  return chats.some(chat => chat.active_stream_id !== null);
}
