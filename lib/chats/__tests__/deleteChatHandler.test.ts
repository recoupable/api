import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { deleteChatHandler } from "../deleteChatHandler";
import { validateDeleteChatBody } from "../validateDeleteChatBody";
import { deleteRoomWithRelations } from "@/lib/supabase/rooms/deleteRoomWithRelations";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateDeleteChatBody", () => ({
  validateDeleteChatBody: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/deleteRoomWithRelations", () => ({
  deleteRoomWithRelations: vi.fn(),
}));

describe("deleteChatHandler", () => {
  const chatId = "123e4567-e89b-12d3-a456-426614174000";

  const request = new NextRequest("http://localhost/api/chats", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify({ chatId }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes chat and returns success response", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue({ chatId });
    vi.mocked(deleteRoomWithRelations).mockResolvedValue(true);

    const response = await deleteChatHandler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      status: "success",
      chatId,
      message: "Chat deleted successfully",
    });
    expect(deleteRoomWithRelations).toHaveBeenCalledWith(chatId);
  });

  it("returns validation response when request is invalid", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue(
      NextResponse.json({ status: "error", error: "chatId is required" }, { status: 400 }),
    );

    const response = await deleteChatHandler(request);
    expect(response.status).toBe(400);
    expect(deleteRoomWithRelations).not.toHaveBeenCalled();
  });

  it("returns 500 when deletion fails", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue({ chatId });
    vi.mocked(deleteRoomWithRelations).mockResolvedValue(false);

    const response = await deleteChatHandler(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("Failed to delete chat");
  });

  it("returns 500 when deletion throws", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue({ chatId });
    vi.mocked(deleteRoomWithRelations).mockRejectedValue(new Error("Database down"));

    const response = await deleteChatHandler(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("Database down");
  });
});
