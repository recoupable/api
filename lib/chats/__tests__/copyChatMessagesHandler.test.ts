import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { copyChatMessagesHandler } from "@/lib/chats/copyChatMessagesHandler";
import { validateCopyChatMessagesBody } from "@/lib/chats/validateCopyChatMessagesBody";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";
import { copyChatMessages } from "@/lib/chats/copyChatMessages";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateCopyChatMessagesBody", () => ({
  validateCopyChatMessagesBody: vi.fn(),
}));

vi.mock("@/lib/chats/validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

vi.mock("@/lib/chats/copyChatMessages", () => ({
  copyChatMessages: vi.fn(),
}));

const sourceChatId = "123e4567-e89b-42d3-a456-426614174000";
const targetChatId = "123e4567-e89b-42d3-a456-426614174001";
const request = new NextRequest(`http://localhost/api/chats/${sourceChatId}/messages/copy`, {
  method: "POST",
  body: JSON.stringify({ targetChatId }),
  headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
});

describe("copyChatMessagesHandler", () => {
  const accessRoom = (id: string) => ({
    roomId: id,
    room: {
      id,
      account_id: "11111111-1111-1111-1111-111111111111",
      artist_id: null,
      topic: null,
      updated_at: null,
    },
    accountId: "11111111-1111-1111-1111-111111111111",
  });

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
    expect(copyChatMessages).not.toHaveBeenCalled();
  });

  it("returns 500 when source messages cannot be loaded", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(sourceChatId));
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(targetChatId));
    vi.mocked(copyChatMessages).mockResolvedValue({
      status: "error",
      error: "Failed to load source chat messages",
    });

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to load source chat messages");
  });

  it("clears target and copies messages", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(sourceChatId));
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(targetChatId));
    vi.mocked(copyChatMessages).mockResolvedValue({
      status: "success",
      copiedCount: 1,
      clearedExisting: true,
    });

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(copyChatMessages).toHaveBeenCalledWith({
      sourceChatId,
      targetChatId,
      clearExisting: true,
    });
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
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(sourceChatId));
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(targetChatId));
    vi.mocked(copyChatMessages).mockResolvedValue({
      status: "error",
      error: "Failed to clear target chat messages",
    });

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to clear target chat messages");
  });

  it("skips clear when clearExisting is false", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      targetChatId,
      clearExisting: false,
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(sourceChatId));
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(targetChatId));
    vi.mocked(copyChatMessages).mockResolvedValue({
      status: "success",
      copiedCount: 0,
      clearedExisting: false,
    });

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.copied_count).toBe(0);
    expect(body.cleared_existing).toBe(false);
  });

  it("returns 500 when validation throws unexpectedly", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockRejectedValue(new Error("boom"));

    const response = await copyChatMessagesHandler(request, sourceChatId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to copy chat messages",
    });
  });

  it("passes through source chat access errors", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await copyChatMessagesHandler(request, sourceChatId);

    expect(response.status).toBe(401);
    expect(copyChatMessages).not.toHaveBeenCalled();
  });

  it("passes through target chat access errors", async () => {
    vi.mocked(validateCopyChatMessagesBody).mockResolvedValue({
      targetChatId,
      clearExisting: true,
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(accessRoom(sourceChatId));
    vi.mocked(validateChatAccess).mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );

    const response = await copyChatMessagesHandler(request, sourceChatId);

    expect(response.status).toBe(403);
    expect(copyChatMessages).not.toHaveBeenCalled();
  });
});
