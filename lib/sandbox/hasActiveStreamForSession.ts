import { selectChats } from "@/lib/supabase/chats/selectChats";

/**
 * True when any chat in the session has an `active_stream_id` set,
 * indicating an in-flight assistant stream. The lifecycle workflow
 * uses this to defer hibernation while a chat is actively being
 * served — pausing the sandbox mid-stream would 500 the response.
 *
 * @param sessionId - The session to check.
 * @returns true when at least one chat has an active stream id.
 */
export async function hasActiveStreamForSession(sessionId: string): Promise<boolean> {
  const chats = (await selectChats({ sessionId })) ?? [];
  return chats.some(chat => chat.active_stream_id !== null);
}
