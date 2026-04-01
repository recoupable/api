import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateGetChatMessagesQuery } from "@/lib/chats/validateGetChatMessagesQuery";

vi.mock("@/lib/chats/validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

const { validateChatAccess } = await import("@/lib/chats/validateChatAccess");

const createRequest = () =>
  new NextRequest("http://localhost/api/chats/test/messages");

describe("validateGetChatMessagesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid UUID", async () => {
    const result = await validateGetChatMessagesQuery(createRequest(), "not-a-uuid");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns NextResponse when chat access fails", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue(
      NextResponse.json({ status: "error" }, { status: 403 }),
    );

    const result = await validateGetChatMessagesQuery(
      createRequest(),
      "123e4567-e89b-42d3-a456-426614174000",
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns validated room data on success", async () => {
    const roomId = "123e4567-e89b-42d3-a456-426614174000";
    vi.mocked(validateChatAccess).mockResolvedValue({
      roomId,
      room: { id: roomId, account_id: null, artist_id: null, topic: null, updated_at: null },
      accountId: "acc-123",
    });

    const result = await validateGetChatMessagesQuery(createRequest(), roomId);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect((result as { roomId: string }).roomId).toBe(roomId);
  });
});
