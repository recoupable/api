import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCopyChatMessagesBody } from "@/lib/chats/validateCopyChatMessagesBody";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

const sourceChatId = "123e4567-e89b-42d3-a456-426614174000";
const targetChatId = "123e4567-e89b-42d3-a456-426614174001";

const createRequest = (body: unknown) =>
  new NextRequest(`http://localhost/api/chats/${sourceChatId}/messages/copy`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
  });

describe("validateCopyChatMessagesBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid body", async () => {
    const result = await validateCopyChatMessagesBody(createRequest({}), sourceChatId);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateChatAccess).not.toHaveBeenCalled();
  });

  it("returns 400 when source and target ids are same", async () => {
    const result = await validateCopyChatMessagesBody(
      createRequest({ targetChatId: sourceChatId }),
      sourceChatId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    expect(validateChatAccess).not.toHaveBeenCalled();
  });

  it("passes through source access errors", async () => {
    vi.mocked(validateChatAccess).mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const result = await validateCopyChatMessagesBody(
      createRequest({ targetChatId }),
      sourceChatId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("passes through target access errors", async () => {
    vi.mocked(validateChatAccess).mockResolvedValueOnce({
      roomId: sourceChatId,
      room: {
        id: sourceChatId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );

    const result = await validateCopyChatMessagesBody(
      createRequest({ targetChatId }),
      sourceChatId,
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns validated payload and defaults clearExisting to true", async () => {
    vi.mocked(validateChatAccess).mockResolvedValueOnce({
      roomId: sourceChatId,
      room: {
        id: sourceChatId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(validateChatAccess).mockResolvedValueOnce({
      roomId: targetChatId,
      room: {
        id: targetChatId,
        account_id: "11111111-1111-1111-1111-111111111111",
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });

    const result = await validateCopyChatMessagesBody(
      createRequest({ targetChatId }),
      sourceChatId,
    );

    expect(result).toEqual({
      sourceChatId,
      targetChatId,
      clearExisting: true,
    });
  });
});
