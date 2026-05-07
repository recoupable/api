import supabase from "@/lib/supabase/serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Reads all `chats` belonging to a session. Used by the lifecycle
 * workflow to detect active streams (so a chat in flight can prevent
 * hibernation), and will be used by upcoming `GET /api/sessions/:id/chats`
 * port too. Returns [] on Supabase error after logging.
 *
 * @param sessionId - The owning session id.
 * @returns Matching chat rows, or [] on error / no match.
 */
export async function selectChatsBySession(sessionId: string): Promise<Tables<"chats">[]> {
  const { data, error } = await supabase.from("chats").select("*").eq("session_id", sessionId);

  if (error) {
    console.error(`[selectChatsBySession] error for session ${sessionId}:`, error);
    return [];
  }

  return data ?? [];
}
