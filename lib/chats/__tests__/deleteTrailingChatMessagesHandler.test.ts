import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { deleteTrailingChatMessagesHandler } from "@/lib/chats/deleteTrailingChatMessagesHandler";
import { validateDeleteTrailingMessagesQuery } from "@/lib/chats/validateDeleteTrailingMessagesQuery";
import deleteMemories from "@/lib/supabase/memories/deleteMemories";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateDeleteTrailingMessagesQuery", () => ({
  validateDeleteTrailingMessagesQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/deleteMemories", () => ({
  default: vi.fn(),
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const fromMessageId = "123e4567-e89b-42d3-a456-426614174001";
const request = new NextRequest(
  `http://localhost/api/chats/${chatId}/messages/trailing?from_message_id=${fromMessageId}`,
  { method: "DELETE" },
);

describe("deleteTrailingChatMessagesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes through validation errors", async () => {
    vi.mocked(validateDeleteTrailingMessagesQuery).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Bad request" }, { status: 400 }),
    );

    const response = await deleteTrailingChatMessagesHandler(request, chatId);
    expect(response.status).toBe(400);
  });

  it("returns 500 when delete fails", async () => {
    vi.mocked(validateDeleteTrailingMessagesQuery).mockResolvedValue({
      chatId,
      fromMessageId,
      fromTimestamp: "2026-03-31T00:00:00.000Z",
    });
    vi.mocked(deleteMemories).mockResolvedValue(null);

    const response = await deleteTrailingChatMessagesHandler(request, chatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to delete trailing messages",
    });
  });

  it("returns success with deleted count", async () => {
    vi.mocked(validateDeleteTrailingMessagesQuery).mockResolvedValue({
      chatId,
      fromMessageId,
      fromTimestamp: "2026-03-31T00:00:00.000Z",
    });
    vi.mocked(deleteMemories).mockResolvedValue(3);

    const response = await deleteTrailingChatMessagesHandler(request, chatId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "success",
      chat_id: chatId,
      from_message_id: fromMessageId,
      deleted_count: 3,
    });
  });

  it("returns 500 when validation throws unexpectedly", async () => {
    vi.mocked(validateDeleteTrailingMessagesQuery).mockRejectedValue(new Error("boom"));

    const response = await deleteTrailingChatMessagesHandler(request, chatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to delete trailing messages",
    });
  });
});
