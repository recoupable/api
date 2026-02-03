import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateUpdateChatBody } from "../validateUpdateChatBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/chats/buildGetChatsParams", () => ({
  buildGetChatsParams: vi.fn(),
}));

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { buildGetChatsParams } from "@/lib/chats/buildGetChatsParams";

describe("validateUpdateChatBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: object) => {
    return new NextRequest("http://localhost/api/chats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": "test-key" },
      body: JSON.stringify(body),
    });
  };

  describe("successful validation", () => {
    it("returns validated data when user owns the chat", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const accountId = "123e4567-e89b-12d3-a456-426614174001";
      const topic = "Valid Topic";
      const room = {
        id: chatId,
        account_id: accountId,
        artist_id: null,
        topic: "Old Topic",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [accountId] },
        error: null,
      });

      const request = createRequest({ chatId, topic });
      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });

    it("accepts topic at minimum length (3 chars)", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const accountId = "123e4567-e89b-12d3-a456-426614174001";
      const topic = "abc";
      const room = {
        id: chatId,
        account_id: accountId,
        artist_id: null,
        topic: "Old",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [accountId] },
        error: null,
      });

      const request = createRequest({ chatId, topic });
      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });

    it("accepts topic at maximum length (50 chars)", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const accountId = "123e4567-e89b-12d3-a456-426614174001";
      const topic = "a".repeat(50);
      const room = {
        id: chatId,
        account_id: accountId,
        artist_id: null,
        topic: "Old",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: null,
        authToken: "test-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [accountId] },
        error: null,
      });

      const request = createRequest({ chatId, topic });
      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });

    it("allows org key to access member's chat", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const memberAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const orgId = "123e4567-e89b-12d3-a456-426614174002";
      const topic = "Valid Topic";
      const room = {
        id: chatId,
        account_id: memberAccountId,
        artist_id: null,
        topic: "Old",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: orgId,
        orgId,
        authToken: "org-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [memberAccountId, "other-member"] },
        error: null,
      });

      const request = createRequest({ chatId, topic });
      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });

    it("allows admin access when account_ids is undefined", async () => {
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const accountId = "123e4567-e89b-12d3-a456-426614174001";
      const topic = "Valid Topic";
      const room = {
        id: chatId,
        account_id: "any-account",
        artist_id: null,
        topic: "Old",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId,
        orgId: "admin-org",
        authToken: "admin-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: {}, // No account_ids = admin access
        error: null,
      });

      const request = createRequest({ chatId, topic });
      const result = await validateUpdateChatBody(request);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect(result).toEqual({ chatId, topic });
    });
  });

  describe("body validation errors", () => {
    it("returns 400 when chatId is missing", async () => {
      const request = createRequest({ topic: "Valid Topic" });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.status).toBe("error");
    });

    it("returns 400 when chatId is not a valid UUID", async () => {
      const request = createRequest({ chatId: "not-a-uuid", topic: "Valid Topic" });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("UUID");
    });

    it("returns 400 when topic is missing", async () => {
      const request = createRequest({ chatId: "123e4567-e89b-12d3-a456-426614174000" });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("returns 400 when topic is too short", async () => {
      const request = createRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "ab",
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("3 and 50");
    });

    it("returns 400 when topic is too long", async () => {
      const request = createRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "a".repeat(51),
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("3 and 50");
    });
  });

  describe("JSON parsing errors", () => {
    it("handles invalid JSON gracefully", async () => {
      const request = new NextRequest("http://localhost/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });

    it("handles empty body gracefully", async () => {
      const request = new NextRequest("http://localhost/api/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(400);
    });
  });

  describe("authentication errors", () => {
    it("returns 401 when auth fails", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Unauthorized" },
          { status: 401 },
        ),
      );

      const request = createRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "Valid Topic",
      });
      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(401);
    });
  });

  describe("room not found errors", () => {
    it("returns 404 when chat does not exist", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "123e4567-e89b-12d3-a456-426614174001",
        orgId: null,
        authToken: "test-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(null);

      const request = createRequest({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        topic: "Valid Topic",
      });
      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("not found");
    });
  });

  describe("access denied errors", () => {
    it("returns 403 when user tries to update another user's chat", async () => {
      const userAccountId = "123e4567-e89b-12d3-a456-426614174001";
      const otherAccountId = "123e4567-e89b-12d3-a456-426614174002";
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const room = {
        id: chatId,
        account_id: otherAccountId,
        artist_id: null,
        topic: "Old Topic",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: userAccountId,
        orgId: null,
        authToken: "test-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: [userAccountId] },
        error: null,
      });

      const request = createRequest({
        chatId,
        topic: "Valid Topic",
      });
      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Access denied");
    });

    it("returns 403 when org key cannot access non-member's chat", async () => {
      const orgId = "123e4567-e89b-12d3-a456-426614174001";
      const nonMemberAccountId = "123e4567-e89b-12d3-a456-426614174002";
      const chatId = "123e4567-e89b-12d3-a456-426614174000";
      const room = {
        id: chatId,
        account_id: nonMemberAccountId,
        artist_id: null,
        topic: "Old Topic",
        updated_at: "2024-01-01T00:00:00Z",
      };

      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: orgId,
        orgId,
        authToken: "org-key",
      });

      vi.mocked(selectRoom).mockResolvedValue(room);

      vi.mocked(buildGetChatsParams).mockResolvedValue({
        params: { account_ids: ["member-1", "member-2"] }, // non-member not in list
        error: null,
      });

      const request = createRequest({
        chatId,
        topic: "Valid Topic",
      });
      const result = await validateUpdateChatBody(request);

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Access denied");
    });
  });
});
