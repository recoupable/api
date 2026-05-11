import type { Tables } from "@/types/database.types";

/**
 * Translates a Supabase `chats` row into the `ChatSummary` shape the
 * open-agents frontend already consumes. `hasUnread` is derived from
 * `chat.last_assistant_message_at` vs the caller's last read, and
 * `isStreaming` from the row's `active_stream_id`.
 *
 * @param row - The Supabase chats row.
 * @param lastReadAt - The caller's last-read timestamp for this chat, if any.
 * @returns The camelCase chat summary payload for HTTP responses.
 */
export function toChatSummaryResponse(row: Tables<"chats">, lastReadAt: string | null) {
  const lastAssistantMessageAt = row.last_assistant_message_at;
  const hasUnread =
    lastAssistantMessageAt !== null &&
    (lastReadAt === null ||
      new Date(lastAssistantMessageAt).getTime() > new Date(lastReadAt).getTime());

  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    modelId: row.model_id,
    activeStreamId: row.active_stream_id,
    lastAssistantMessageAt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasUnread,
    isStreaming: row.active_stream_id !== null,
  };
}
