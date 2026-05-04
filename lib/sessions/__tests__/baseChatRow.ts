import type { Tables } from "@/types/database.types";

/**
 * Returns a fully-populated `chats` row suitable for mocking
 * `insertChat` in tests. Pass `overrides` to customize fields per case.
 */
export function baseChatRow(overrides: Partial<Tables<"chats">> = {}): Tables<"chats"> {
  return {
    id: "chat_1",
    session_id: "sess_1",
    title: "New chat",
    model_id: null,
    active_stream_id: null,
    last_assistant_message_at: null,
    created_at: "2026-05-04T00:00:00.000Z",
    updated_at: "2026-05-04T00:00:00.000Z",
    ...overrides,
  };
}
