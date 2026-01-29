import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { compactChatsHandler } from "../compactChatsHandler";

const mockValidateAuthContext = vi.fn();
const mockSelectRoom = vi.fn();
const mockCanAccessAccount = vi.fn();
const mockCompactChat = vi.fn();

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: (...args: unknown[]) => mockValidateAuthContext(...args),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: (...args: unknown[]) => mockSelectRoom(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

vi.mock("../compactChat", () => ({
  compactChat: (...args: unknown[]) => mockCompactChat(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock NextRequest with a JSON body.
 *
 * @param body - The request body.
 * @param apiKey - The API key header value.
 * @returns A mock NextRequest.
 */
function createMockRequest(body: unknown, apiKey = "test-api-key"): NextRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    headers: {
      get: (name: string) => (name === "x-api-key" ? apiKey : null),
    },
  } as unknown as NextRequest;
}

describe("compactChatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("returns auth error when validateAuthContext fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.status).toBe("error");
    });
  });

  describe("validation", () => {
    it("returns 400 when chatId is missing", async () => {
      const request = createMockRequest({});
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 when chatId array is empty", async () => {
      const request = createMockRequest({ chatId: [] });
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 when chatId contains invalid UUID", async () => {
      const request = createMockRequest({ chatId: ["invalid-uuid"] });
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe("access control", () => {
    it("returns 404 when chat does not exist", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "test-token",
      });
      mockSelectRoom.mockResolvedValue(null);

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe(404);
      expect(json.message).toContain("not found");
    });

    it("returns 404 when user does not have access to the chat", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "test-token",
      });
      mockSelectRoom.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        account_id: "other-account",
        topic: "Test Chat",
      });
      mockCanAccessAccount.mockResolvedValue(false);

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe(404);
    });

    it("allows access when user owns the chat", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "test-token",
      });
      mockSelectRoom.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        account_id: "account-123",
        topic: "Test Chat",
      });
      mockCompactChat.mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        compacted: "Summary text",
      });

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.chats).toHaveLength(1);
      expect(json.chats[0].compacted).toBe("Summary text");
    });

    it("allows org key access to member's chat", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "org-account",
        orgId: "org-123",
        authToken: "test-token",
      });
      mockSelectRoom.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        account_id: "member-account",
        topic: "Test Chat",
      });
      mockCanAccessAccount.mockResolvedValue(true);
      mockCompactChat.mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        compacted: "Summary text",
      });

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(200);
      expect(mockCanAccessAccount).toHaveBeenCalledWith({
        orgId: "org-123",
        targetAccountId: "member-account",
      });
    });
  });

  describe("parallel processing", () => {
    it("processes multiple chats in parallel", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "test-token",
      });

      // Track the order of operations to verify parallelism
      const callOrder: string[] = [];

      mockSelectRoom.mockImplementation(async (chatId: string) => {
        callOrder.push(`selectRoom:${chatId}:start`);
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push(`selectRoom:${chatId}:end`);
        return {
          id: chatId,
          account_id: "account-123",
          topic: `Chat ${chatId}`,
        };
      });

      mockCompactChat.mockImplementation(async (chatId: string) => {
        callOrder.push(`compactChat:${chatId}:start`);
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push(`compactChat:${chatId}:end`);
        return { chatId, compacted: `Summary for ${chatId}` };
      });

      const chatIds = [
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
        "123e4567-e89b-12d3-a456-426614174003",
      ];
      const request = createMockRequest({ chatId: chatIds });
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(200);

      // Verify parallel execution: all selectRoom:start calls should happen
      // before any selectRoom:end calls complete (indicating parallel execution)
      const selectRoomStartIndices = chatIds.map(id => callOrder.indexOf(`selectRoom:${id}:start`));
      const firstSelectRoomEndIndex = Math.min(
        ...chatIds.map(id => callOrder.indexOf(`selectRoom:${id}:end`)),
      );

      // All starts should happen before any end in parallel execution
      selectRoomStartIndices.forEach(startIndex => {
        expect(startIndex).toBeLessThan(firstSelectRoomEndIndex);
      });
    });
  });

  describe("successful responses", () => {
    it("compacts multiple chats successfully", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "test-token",
      });
      mockSelectRoom
        .mockResolvedValueOnce({
          id: "chat-1",
          account_id: "account-123",
          topic: "Chat 1",
        })
        .mockResolvedValueOnce({
          id: "chat-2",
          account_id: "account-123",
          topic: "Chat 2",
        });
      mockCompactChat
        .mockResolvedValueOnce({
          chatId: "chat-1",
          compacted: "Summary 1",
        })
        .mockResolvedValueOnce({
          chatId: "chat-2",
          compacted: "Summary 2",
        });

      const chatIds = [
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
      ];
      const request = createMockRequest({ chatId: chatIds });
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.chats).toHaveLength(2);
      expect(json.chats[0].compacted).toBe("Summary 1");
      expect(json.chats[1].compacted).toBe("Summary 2");
    });

    it("passes custom prompt to compactChat", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "test-token",
      });
      mockSelectRoom.mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        account_id: "account-123",
        topic: "Test Chat",
      });
      mockCompactChat.mockResolvedValue({
        chatId: "123e4567-e89b-12d3-a456-426614174000",
        compacted: "Custom summary",
      });

      const customPrompt = "Focus on action items only";
      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
        prompt: customPrompt,
      });
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(200);
      expect(mockCompactChat).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        customPrompt,
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 when an exception is thrown", async () => {
      mockValidateAuthContext.mockRejectedValue(new Error("Unexpected error"));

      const request = createMockRequest({
        chatId: ["123e4567-e89b-12d3-a456-426614174000"],
      });
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe(500);
      expect(json.message).toBe("Unexpected error");
    });
  });
});
