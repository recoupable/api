import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getChatMessagesHandler } from "@/lib/chats/getChatMessagesHandler";
import { validateChatAccess } from "@/lib/chats/validateChatAccess";
import selectMemories from "@/lib/supabase/memories/selectMemories";

vi.mock("@/lib/chats/validateChatAccess", () => ({
  validateChatAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/selectMemories", () => ({
  default: vi.fn(),
}));

const createRequest = (roomId?: string) =>
  new NextRequest(`http://localhost/api/chats/${roomId ?? "missing"}/messages`);

describe("getChatMessagesHandler", () => {
  const roomId = "123e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid chat id", async () => {
    const response = await getChatMessagesHandler(createRequest(), "invalid-id");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      status: "error",
      error: "id must be a valid UUID",
    });
  });

  it("returns room access error when validation fails", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );

    const response = await getChatMessagesHandler(createRequest(roomId), roomId);
    expect(response.status).toBe(401);
  });

  it("returns 500 when memories query fails", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({
      room: {
        id: roomId,
        account_id: null,
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectMemories).mockResolvedValue(null);

    const response = await getChatMessagesHandler(createRequest(roomId), roomId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to retrieve memories",
    });
  });

  it("returns memories for an accessible room", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({
      room: {
        id: roomId,
        account_id: null,
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectMemories).mockResolvedValue([
      {
        id: "123e4567-e89b-42d3-a456-426614174111",
        room_id: roomId,
        content: { role: "user", content: "hello" },
        updated_at: "2026-03-31T00:00:00.000Z",
      },
    ]);

    const response = await getChatMessagesHandler(createRequest(roomId), roomId);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [
        {
          id: "123e4567-e89b-42d3-a456-426614174111",
          room_id: roomId,
          content: { role: "user", content: "hello" },
          updated_at: "2026-03-31T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns 500 when validateChatAccess throws unexpectedly", async () => {
    vi.mocked(validateChatAccess).mockRejectedValue(new Error("boom"));

    const response = await getChatMessagesHandler(createRequest(roomId), roomId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to retrieve memories",
    });
  });

  it("returns 500 when selectMemories throws unexpectedly", async () => {
    vi.mocked(validateChatAccess).mockResolvedValue({
      room: {
        id: roomId,
        account_id: null,
        artist_id: null,
        topic: null,
        updated_at: null,
      },
      accountId: "11111111-1111-1111-1111-111111111111",
    });
    vi.mocked(selectMemories).mockRejectedValue(new Error("db blew up"));

    const response = await getChatMessagesHandler(createRequest(roomId), roomId);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error: "Failed to retrieve memories",
    });
  });
});
