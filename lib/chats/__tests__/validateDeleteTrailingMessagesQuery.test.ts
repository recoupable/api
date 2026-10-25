import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Tables } from "@/types/database.types";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chat/validateChatOwnership", () => ({
  validateChatOwnership: vi.fn(),
}));

vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const fromMessageId = "123e4567-e89b-42d3-a456-426614174001";

const createRequest = (query = "") =>
  new NextRequest(`http://localhost/api/chats/${chatId}/messages/trailing${query}`);

describe("validateDeleteTrailingMessagesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through chat access errors", async () => {
    vi.mocked(validateChatOwnership).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateDeleteTrailingMessagesQuery(createRequest(), chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when from_message_id is missing", async () => {
    vi.mocked(validateChatOwnership).mockResolvedValue({
      auth: { accountId: "owner" },
      chat: { id: chatId, active_stream_id: null },
    } as never);

    const result = await validateDeleteTrailingMessagesQuery(createRequest(), chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 404 when message does not exist", async () => {
    vi.mocked(validateChatOwnership).mockResolvedValue({
      auth: { accountId: "owner" },
      chat: { id: chatId, active_stream_id: null },
    } as never);
    vi.mocked(selectChatMessages).mockResolvedValue([]);

    const result = await validateDeleteTrailingMessagesQuery(
      createRequest(`?from_message_id=${fromMessageId}`),
      chatId,
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns validated payload when query is valid", async () => {
    vi.mocked(validateChatOwnership).mockResolvedValue({
      auth: { accountId: "owner" },
      chat: { id: chatId, active_stream_id: null },
    } as never);
    vi.mocked(selectChatMessages).mockResolvedValue([
      {
        id: fromMessageId,
        chat_id: chatId,
        created_at: "2026-03-31T00:00:00.000Z",
      } as Tables<"chat_messages">,
    ]);

    const result = await validateDeleteTrailingMessagesQuery(
      createRequest(`?from_message_id=${fromMessageId}`),
      chatId,
    );

    expect(result).toEqual({
      chatId,
      fromMessageId,
      fromTimestamp: "2026-03-31T00:00:00.000Z",
    });
  });
  it("fails closed on a malformed stored UUID", async () => {
    vi.mocked(validateChatOwnership).mockResolvedValue({
      auth: { accountId: "owner" },
      chat: { id: chatId, active_stream_id: null },
    } as never);
    vi.mocked(selectChatMessages).mockResolvedValue([
      { id: "invalid", created_at: "2026-10-25T12:00:00.123456Z" },
    ] as never);
    const result = await validateDeleteTrailingMessagesQuery(
      createRequest(`?from_message_id=${fromMessageId}`),
      chatId,
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(500);
  });
});
