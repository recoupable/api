import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { updateChatHandler } from "../updateChatHandler";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/chats/validateUpdateChatBody", () => ({
  validateUpdateChatBody: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/updateRoom", () => ({
  updateRoom: vi.fn(),
}));

vi.mock("@/lib/chats/buildGetChatsParams", () => ({
  buildGetChatsParams: vi.fn(),
}));

import { validateUpdateChatBody } from "@/lib/chats/validateUpdateChatBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { updateRoom } from "@/lib/supabase/rooms/updateRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

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
    it("updates chat topic when user owns the chat (personal key)", async () => {
      const accountId = "123e4567-e89b-12d3-a456-426614174000";
      const chatId = "123e4567-e89b-12d3-a456-426614174001";
      const newTopic = "My Updated Chat";

      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId,
        topic: newTopic,
      });

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null, // Personal key
        authToken: "test-key",
      });

      vi.mocked(selectRoom).mockResolvedValue({
        id: chatId,
        account_id: accountId, // User owns this chat
        artist_id: null,
        topic: "Old Topic",
        updated_at: "2024-01-01T00:00:00Z",
      });

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [accountId] },
        error: null,
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

      // Verify buildGetChatsParams was called WITHOUT target_account_id
      expect(buildGetChatsParams).toHaveBeenCalledWith({
        account_id: accountId,
        org_id: null,
      });
    });

    it("updates chat topic when org key has access to member's chat", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174002";
      const memberAccountId = "123e4567-e89b-12d3-a456-426614174003";
      const chatId = "123e4567-e89b-12d3-a456-426614174004";
      const newTopic = "Org Chat Updated";

      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId,
        topic: newTopic,
      });

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: orgId,
        orgId: orgId,
        authToken: "org-key",
      });

      vi.mocked(selectRoom).mockResolvedValue({
        id: chatId,
        account_id: memberAccountId,
        artist_id: null,
        topic: "Old Topic",
        updated_at: "2024-01-01T00:00:00Z",
      });

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [memberAccountId, "other-member"] },
        error: null,
      });

      vi.mocked(updateRoom).mockResolvedValue({
        id: chatId,
        account_id: memberAccountId,
        artist_id: null,
        topic: newTopic,
        updated_at: "2024-01-02T00:00:00Z",
      });

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(200);
    });
  });

  describe("validation errors", () => {
    it("returns 400 when validation fails", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "chatId must be a valid UUID" },
          { status: 400 },
        ),
      );

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
    });
  });

  describe("authentication errors", () => {
    it("returns 401 when no auth provided", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "Valid Topic",
      });

      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Unauthorized" },
          { status: 401 },
        ),
      );

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe("not found errors", () => {
    it("returns 404 when chat does not exist", async () => {
      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "Valid Topic",
      });

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "123e4567-e89b-12d3-a456-426614174008",
        orgId: null,
        authToken: "key",
      });

      vi.mocked(selectRoom).mockResolvedValue(null);

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("not found");
    });
  });

  describe("access denied errors", () => {
    it("returns 403 when user tries to update another user's chat", async () => {
      const userAccountId = "123e4567-e89b-12d3-a456-426614174005";
      const otherAccountId = "123e4567-e89b-12d3-a456-426614174006";
      const chatId = "123e4567-e89b-12d3-a456-426614174007";

      vi.mocked(validateUpdateChatBody).mockResolvedValue({
        chatId,
        topic: "Valid Topic",
      });

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: userAccountId,
        orgId: null,
        authToken: "key",
      });

      vi.mocked(selectRoom).mockResolvedValue({
        id: chatId,
        account_id: otherAccountId, // Different user owns this
        artist_id: null,
        topic: "Old Topic",
        updated_at: "2024-01-01T00:00:00Z",
      });

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [userAccountId] }, // Only has access to own account
        error: null,
      });

      const request = mockRequest();
      const response = await updateChatHandler(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Access denied");
    });
  });
});
