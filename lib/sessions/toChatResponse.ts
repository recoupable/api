import type { Tables } from "@/types/database.types";

/**
 * Translates a Supabase `chats` row into the camelCase shape returned
 * by the API. Mirrors `toSessionResponse` so wire format stays aligned
 * with what open-agents' frontend already consumes.
 *
 * @param row - The Supabase chats row.
 * @returns The camelCase chat payload for HTTP responses.
 */
export function toChatResponse(row: Tables<"chats">) {
  return {
    id: row.id,
    sessionId: row.session_id,
    title: row.title,
    modelId: row.model_id,
    activeStreamId: row.active_stream_id,
    lastAssistantMessageAt: row.last_assistant_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
