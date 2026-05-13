import { DEFAULT_MODEL } from "@/lib/const";
import type { Tables } from "@/types/database.types";

/**
 * Maps a `chats` row plus optional read cursor into the `ChatSummary` wire shape
 * for `GET /api/sessions/{sessionId}/chats`. Aligns unread logic with
 * open-agents: no assistant message → not unread; missing read row → unread when
 * there is an assistant message.
 *
 * @param row - Supabase chat row.
 * @param lastReadAt - `chat_reads.last_read_at` for this account+chat, if any.
 */
export function toChatSummary(row: Tables<"chats">, lastReadAt: string | null) {
  const assistantAt = row.last_assistant_message_at;
  const hasUnread =
    assistantAt != null &&
    (lastReadAt == null || new Date(assistantAt) > new Date(lastReadAt));

  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    modelId: row.model_id ?? DEFAULT_MODEL,
    activeStreamId: row.active_stream_id,
    lastAssistantMessageAt: row.last_assistant_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasUnread,
    isStreaming: row.active_stream_id != null,
  };
}
