import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Tables } from "@/types/database.types";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";
import selectMemories from "@/lib/supabase/memories/selectMemories";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/selectMemories", () => ({
  default: vi.fn(),
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
    vi.mocked(validateChatAccess).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateDeleteTrailingMessagesQuery(createRequest(), chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 400 when from_message_id is missing", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({
      roomId: chatId,
      room: {
        id: chatId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });

    const result = await validateDeleteTrailingMessagesQuery(createRequest(), chatId);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 404 when message does not exist", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({
      roomId: chatId,
      room: {
        id: chatId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectMemories).mockResolvedValue([]);

    const result = await validateDeleteTrailingMessagesQuery(
      createRequest(`?from_message_id=${fromMessageId}`),
      chatId,
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns validated payload when query is valid", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({
      roomId: chatId,
      room: {
        id: chatId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectMemories).mockResolvedValue([
      {
        id: fromMessageId,
        room_id: chatId,
        updated_at: "2026-03-31T00:00:00.000Z",
      } as Tables<"memories">,
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
});
