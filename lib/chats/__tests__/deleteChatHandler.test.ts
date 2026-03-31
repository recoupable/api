import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { deleteChatHandler } from "../deleteChatHandler";
import { validateDeleteChatBody } from "../validateDeleteChatBody";
import { deleteRoom } from "@/lib/supabase/rooms/deleteRoom";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateDeleteChatBody", () => ({
  validateDeleteChatBody: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/deleteRoom", () => ({
  deleteRoom: vi.fn(),
}));

describe("deleteChatHandler", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";

  const request = new NextRequest("http://localhost/api/chats", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
    body: JSON.stringify({ id }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes chat and returns success response", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue({ id });
    vi.mocked(deleteRoom).mockResolvedValue(true);

    const response = await deleteChatHandler(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      status: "success",
      id,
      message: "Chat deleted successfully",
    });
    expect(deleteRoom).toHaveBeenCalledWith(id);
  });

  it("returns validation response when request is invalid", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue(
      NextResponse.json({ status: "error", error: "chatId is required" }, { status: 400 }),
    );

    const response = await deleteChatHandler(request);
    expect(response.status).toBe(400);
    expect(deleteRoom).not.toHaveBeenCalled();
  });

  it("returns 500 when deletion fails", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue({ id });
    vi.mocked(deleteRoom).mockResolvedValue(false);

    const response = await deleteChatHandler(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("Failed to delete chat");
  });

  it("returns 500 with generic message when deletion throws", async () => {
    vi.mocked(validateDeleteChatBody).mockResolvedValue({ id });
    vi.mocked(deleteRoom).mockRejectedValue(new Error("Database down"));

    const response = await deleteChatHandler(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.status).toBe("error");
    expect(body.error).toBe("Server error");
  });
});
