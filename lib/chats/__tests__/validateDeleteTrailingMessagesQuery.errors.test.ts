import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import { validateWorkflowChatAccess } from "@/lib/chats/validateWorkflowChatAccess";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateWorkflowChatAccess", () => ({
  validateWorkflowChatAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const fromMessageId = "123e4567-e89b-42d3-a456-426614174001";

const createRequest = (query = "") =>
  new NextRequest(`http://localhost/api/chats/${chatId}/messages/trailing${query}`);

const accessResult = {
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
};

describe("validateDeleteTrailingMessagesQuery errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through chat access errors", async () => {
    vi.mocked(validateWorkflowChatAccess).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateDeleteTrailingMessagesQuery(createRequest(), chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when from_message_id is missing", async () => {
    vi.mocked(validateWorkflowChatAccess).mockResolvedValue(accessResult);

    const result = await validateDeleteTrailingMessagesQuery(createRequest(), chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 404 when message does not exist", async () => {
    vi.mocked(validateWorkflowChatAccess).mockResolvedValue(accessResult);
    vi.mocked(selectChatMessages).mockResolvedValue([]);

    const result = await validateDeleteTrailingMessagesQuery(
      createRequest(`?from_message_id=${fromMessageId}`),
      chatId,
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 500 when message lookup fails", async () => {
    vi.mocked(validateWorkflowChatAccess).mockResolvedValue(accessResult);
    vi.mocked(selectChatMessages).mockResolvedValue(null);

    const result = await validateDeleteTrailingMessagesQuery(
      createRequest(`?from_message_id=${fromMessageId}`),
      chatId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(500);
    expect(await (result as NextResponse).json()).toEqual({
      status: "error",
      error: "Internal server error",
    });
  });
});
