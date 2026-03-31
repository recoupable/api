import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { copyChatMessagesHandler } from "@/lib/chats/copyChatMessagesHandler";
import { validateCopyChatMessagesBody } from "@/lib/chats/validateCopyChatMessagesBody";
import selectMemories from "@/lib/supabase/memories/selectMemories";
import deleteMemoriesByRoomId from "@/lib/supabase/memories/deleteMemoriesByRoomId";
import insertCopiedMemories from "@/lib/supabase/memories/insertCopiedMemories";
import { generateUUID } from "@/lib/uuid/generateUUID";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateCopyChatMessagesBody", () => ({
  validateCopyChatMessagesBody: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/selectMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/deleteMemoriesByRoomId", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/insertCopiedMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/uuid/generateUUID", () => ({
  generateUUID: vi.fn(),
}));

const sourceChatId = "123e4567-e89b-42d3-a456-426614174000";
const targetChatId = "123e4567-e89b-42d3-a456-426614174001";
const request = new NextRequest(`http://localhost/api/chats/${sourceChatId}/messages/copy`, {
  method: "POST",
  body: JSON.stringify({ targetChatId }),
  headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
});

describe("copyChatMessagesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validation response when validation fails", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Invalid body" }, { status: 400 }),
    );

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid body");
    expect(selectMemories).not.toHaveBeenCalled();
  });

  it("returns 500 when source messages cannot be loaded", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      sourceChatId,
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(selectMemories).mockResolvedValue(null);

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to load source chat messages");
  });

  it("clears target and copies messages", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      sourceChatId,
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(selectMemories).mockResolvedValue([
      {
        id: "mem-1",
        room_id: sourceChatId,
        content: { role: "user", content: "hello" },
        updated_at: "2026-03-31T00:00:00.000Z",
        created_at: "2026-03-31T00:00:00.000Z",
      },
    ]);
    vi.mocked(deleteMemoriesByRoomId).mockResolvedValue(true);
    vi.mocked(generateUUID).mockReturnValue("new-mem-1");
    vi.mocked(insertCopiedMemories).mockResolvedValue(1);

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteMemoriesByRoomId).toHaveBeenCalledWith(targetChatId);
    expect(insertCopiedMemories).toHaveBeenCalledWith([
      {
        id: "new-mem-1",
        room_id: targetChatId,
        content: { role: "user", content: "hello" },
        updated_at: "2026-03-31T00:00:00.000Z",
      },
    ]);
    expect(body).toEqual({
      status: "success",
      source_chat_id: sourceChatId,
      target_chat_id: targetChatId,
      copied_count: 1,
      cleared_existing: true,
    });
  });

  it("returns 500 when target clear fails", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      sourceChatId,
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(selectMemories).mockResolvedValue([]);
    vi.mocked(deleteMemoriesByRoomId).mockResolvedValue(false);

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to clear target chat messages");
    expect(insertCopiedMemories).not.toHaveBeenCalled();
  });

  it("skips clear when clearExisting is false", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      sourceChatId,
      targetChatId,
      clearExisting: false,
    });
    vi.mocked(selectMemories).mockResolvedValue([]);
    vi.mocked(insertCopiedMemories).mockResolvedValue(0);

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteMemoriesByRoomId).not.toHaveBeenCalled();
    expect(body.copied_count).toBe(0);
    expect(body.cleared_existing).toBe(false);
  });
});
