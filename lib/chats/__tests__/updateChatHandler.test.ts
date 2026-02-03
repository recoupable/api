import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { updateChatHandler } from "../updateChatHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateUpdateChatBody", () => ({
  validateUpdateChatBody: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/updateRoom", () => ({
  updateRoom: vi.fn(),
}));

import { validateUpdateChatBody } from "@/lib/chats/validateUpdateChatBody";
import { updateRoom } from "@/lib/supabase/rooms/updateRoom";

describe("updateChatHandler", () => {
  const mockRequest = () => {
    return new NextRequest("http://localhost/api/chats", {
      method: "PATCH",
      headers: { "x-api-key": "test-key", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successful update", () => {
    it("updates chat topic and returns success response", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174001";
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const newTopic = "My Updated Chat";

      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId,
        topic: newTopic,
      });

      vi.mocked(updateRoom).mockResolvedValue({
        id: chatId,
        account_id: accountId,
        artist_id: null,
        topic: newTopic,
        updated_at: "2024-01-02T00:00:00Z",
      });

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        status: "success",
        chat: {
          id: chatId,
          account_id: accountId,
          topic: newTopic,
          updated_at: "2024-01-02T00:00:00Z",
          artist_id: null,
        },
      });

      expect(updateRoom).toHaveBeenCalledWith(chatId, { topic: newTopic });
    });
  });

  describe("validation errors", () => {
    it("returns 400 from validation when body is invalid", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "chatId must be a valid UUID" },
          { status: 400 },
        ),
      );

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(400);
      expect(updateRoom).not.toHaveBeenCalled();
    });

    it("returns 401 from validation when auth fails", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Unauthorized" },
          { status: 401 },
        ),
      );

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(401);
      expect(updateRoom).not.toHaveBeenCalled();
    });

    it("returns 404 from validation when chat not found", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Chat room not found" },
          { status: 404 },
        ),
      );

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(404);
      expect(updateRoom).not.toHaveBeenCalled();
    });

    it("returns 403 from validation when access denied", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Access denied to this chat" },
          { status: 403 },
        ),
      );

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(403);
      expect(updateRoom).not.toHaveBeenCalled();
    });
  });

  describe("update errors", () => {
    it("returns 500 when updateRoom fails", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174001",
        topic: "New Topic",
      });

      vi.mocked(updateRoom).mockResolvedValue(null);

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toContain("Failed to update");
    });

    it("returns 500 when updateRoom throws", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174001",
        topic: "New Topic",
      });

      vi.mocked(updateRoom).mockRejectedValue(new Error("Database error"));

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Database error");
    });
  });
});
