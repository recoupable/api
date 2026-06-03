import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import { validateWorkflowChatAccess } from "@/lib/chats/validateWorkflowChatAccess";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

vi.mock("@/lib/chats/validateWorkflowChatAccess", () => ({
  validateWorkflowChatAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const fromMessageId = "123e4567-e89b-42d3-a456-426614174001";

describe("validateDeleteTrailingMessagesQuery success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated payload when query is valid", async () => {
    vi.mocked(validateWorkflowChatAccess).mockResolvedValue({
      chatId,
      chat: {
        id: chatId,
        session_id: "123e4567-e89b-42d3-a456-426614174010",
        title: "Chat",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        active_stream_id: null,
        last_assistant_message_at: null,
        model_id: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectChatMessages).mockResolvedValue([
      {
        id: fromMessageId,
        chat_id: chatId,
        created_at: "2026-03-31T00:00:00.000Z",
        role: "user",
        parts: [],
      },
    ]);

    const result = await validateDeleteTrailingMessagesQuery(
      new NextRequest(
        `http://localhost/api/chats/${chatId}/messages/trailing?from_message_id=${fromMessageId}`,
      ),
      chatId,
    );

    expect(result).toEqual({
      chatId,
      fromMessageId,
    });
  });
});
