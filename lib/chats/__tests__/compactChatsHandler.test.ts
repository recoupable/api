import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { compactChatsHandler } from "../compactChatsHandler";

const mockValidateCompactChatsRequest = vi.fn();
const mockProcessCompactChatRequest = vi.fn();

vi.mock("../validateCompactChatsRequest", () => ({
  validateCompactChatsRequest: (...args: unknown[]) => mockValidateCompactChatsRequest(...args),
}));

vi.mock("../processCompactChatRequest", () => ({
  processCompactChatRequest: (...args: unknown[]) => mockProcessCompactChatRequest(...args),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock NextRequest.
 *
 * @returns A mock NextRequest.
 */
function createMockRequest(): NextRequest {
  return {
    json: vi.fn(),
    headers: {
      get: vi.fn(),
    },
  } as unknown as NextRequest;
}

describe("compactChatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("returns validation error when validateCompactChatsRequest fails", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Invalid input" }, { status: 400 }),
      );

      const request = createMockRequest();
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(400);
    });

    it("returns auth error when validateCompactChatsRequest returns 401", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest();
      const response = await compactChatsHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe("processing", () => {
    it("calls processCompactChatRequest for each chatId", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue({
        chatIds: ["chat-1", "chat-2"],
        prompt: "Custom prompt",
        accountId: "account-123",
        orgId: "org-456",
      });
      mockProcessCompactChatRequest.mockResolvedValue({
        type: "success",
        result: { chatId: "chat-1", compacted: "Summary" },
      });

      const request = createMockRequest();
      await compactChatsHandler(request);

      expect(mockProcessCompactChatRequest).toHaveBeenCalledTimes(2);
      expect(mockProcessCompactChatRequest).toHaveBeenCalledWith({
        chatId: "chat-1",
        prompt: "Custom prompt",
        accountId: "account-123",
        orgId: "org-456",
      });
      expect(mockProcessCompactChatRequest).toHaveBeenCalledWith({
        chatId: "chat-2",
        prompt: "Custom prompt",
        accountId: "account-123",
        orgId: "org-456",
      });
    });

    it("returns 404 when any chat is not found", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue({
        chatIds: ["chat-1", "chat-2"],
        accountId: "account-123",
      });
      mockProcessCompactChatRequest
        .mockResolvedValueOnce({
          type: "success",
          result: { chatId: "chat-1", compacted: "Summary" },
        })
        .mockResolvedValueOnce({ type: "notFound", chatId: "chat-2" });

      const request = createMockRequest();
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.message).toContain("chat-2");
    });

    it("returns 404 with all not-found chat IDs", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue({
        chatIds: ["chat-1", "chat-2", "chat-3"],
        accountId: "account-123",
      });
      mockProcessCompactChatRequest
        .mockResolvedValueOnce({ type: "notFound", chatId: "chat-1" })
        .mockResolvedValueOnce({
          type: "success",
          result: { chatId: "chat-2", compacted: "Summary" },
        })
        .mockResolvedValueOnce({ type: "notFound", chatId: "chat-3" });

      const request = createMockRequest();
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.message).toContain("chat-1");
      expect(json.message).toContain("chat-3");
    });
  });

  describe("successful responses", () => {
    it("returns 200 with compacted chats", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue({
        chatIds: ["chat-1", "chat-2"],
        accountId: "account-123",
      });
      mockProcessCompactChatRequest
        .mockResolvedValueOnce({
          type: "success",
          result: { chatId: "chat-1", compacted: "Summary 1" },
        })
        .mockResolvedValueOnce({
          type: "success",
          result: { chatId: "chat-2", compacted: "Summary 2" },
        });

      const request = createMockRequest();
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.chats).toHaveLength(2);
      expect(json.chats[0]).toEqual({ chatId: "chat-1", compacted: "Summary 1" });
      expect(json.chats[1]).toEqual({ chatId: "chat-2", compacted: "Summary 2" });
    });

    it("returns empty chats array when no chatIds provided", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue({
        chatIds: [],
        accountId: "account-123",
      });

      const request = createMockRequest();
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.chats).toEqual([]);
    });
  });

  describe("parallel processing", () => {
    it("processes chats in parallel", async () => {
      mockValidateCompactChatsRequest.mockResolvedValue({
        chatIds: ["chat-1", "chat-2", "chat-3"],
        accountId: "account-123",
      });

      const callOrder: string[] = [];
      mockProcessCompactChatRequest.mockImplementation(async ({ chatId }: { chatId: string }) => {
        callOrder.push(`${chatId}:start`);
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push(`${chatId}:end`);
        return { type: "success", result: { chatId, compacted: `Summary for ${chatId}` } };
      });

      const request = createMockRequest();
      await compactChatsHandler(request);

      // Verify parallel execution: all starts should happen before any end
      const startIndices = ["chat-1", "chat-2", "chat-3"].map(id =>
        callOrder.indexOf(`${id}:start`),
      );
      const firstEndIndex = Math.min(
        ...["chat-1", "chat-2", "chat-3"].map(id => callOrder.indexOf(`${id}:end`)),
      );

      startIndices.forEach(startIndex => {
        expect(startIndex).toBeLessThan(firstEndIndex);
      });
    });
  });

  describe("error handling", () => {
    it("returns 500 when an exception is thrown", async () => {
      mockValidateCompactChatsRequest.mockRejectedValue(new Error("Unexpected error"));

      const request = createMockRequest();
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe(500);
      expect(json.message).toBe("Unexpected error");
    });

    it("returns generic message for non-Error exceptions", async () => {
      mockValidateCompactChatsRequest.mockRejectedValue("string error");

      const request = createMockRequest();
      const response = await compactChatsHandler(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.message).toBe("Internal server error");
    });
  });
});
