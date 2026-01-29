import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateChatRequestX402, chatRequestX402Schema } from "../validateChatRequestX402";
import { setupConversation } from "@/lib/chat/setupConversation";

// Mock dependencies
vi.mock("@/lib/chat/setupConversation", () => ({
  setupConversation: vi.fn(),
}));

vi.mock("@/lib/uuid/generateUUID", () => {
  const mockFn = vi.fn(() => "mock-uuid-default");
  return {
    generateUUID: mockFn,
    default: mockFn,
  };
});

const mockSetupConversation = vi.mocked(setupConversation);

/**
 * Helper to create mock NextRequest.
 *
 * @param body - The request body to mock.
 * @returns A mock Request object.
 */
function createMockRequest(body: unknown): Request {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: () => null,
      has: () => false,
    },
  } as unknown as Request;
}

describe("validateChatRequestX402", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetupConversation.mockResolvedValue({
      roomId: "mock-uuid-default",
      memoryId: "mock-uuid-default",
    });
  });

  describe("schema validation", () => {
    it("rejects when accountId is not provided", async () => {
      const request = createMockRequest({ prompt: "Hello" });

      const result = await validateChatRequestX402(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("rejects when neither messages nor prompt is provided", async () => {
      const request = createMockRequest({ accountId: "account-123" });

      const result = await validateChatRequestX402(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("rejects when both messages and prompt are provided", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        messages: [{ role: "user", content: "Hello" }],
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("accepts valid request with messages and accountId", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        messages: [{ role: "user", content: "Hello" }],
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
    });

    it("accepts valid request with prompt and accountId", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello, world!",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
    });
  });

  describe("no authentication required", () => {
    it("does not require x-api-key header", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      // Should succeed without auth headers because x402 payment is the auth
      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
    });

    it("does not require Authorization header", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
    });
  });

  describe("accountId handling", () => {
    it("uses accountId from request body", async () => {
      const request = createMockRequest({
        accountId: "trusted-account-456",
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("trusted-account-456");
    });

    it("passes accountId to setupConversation", async () => {
      const request = createMockRequest({
        accountId: "account-for-setup",
        prompt: "Hello",
      });

      await validateChatRequestX402(request as any);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "account-for-setup",
        }),
      );
    });
  });

  describe("organizationId handling", () => {
    it("uses organizationId from request body without validation", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
        organizationId: "org-456",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("org-456");
    });

    it("sets orgId to null when organizationId is not provided", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBeNull();
    });
  });

  describe("message normalization", () => {
    it("converts prompt to messages array", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello, world!",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).messages).toHaveLength(1);
      expect((result as any).messages[0].role).toBe("user");
      expect((result as any).messages[0].parts[0].text).toBe("Hello, world!");
    });

    it("preserves original messages when provided", async () => {
      const originalMessages = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];
      const request = createMockRequest({
        accountId: "account-123",
        messages: originalMessages,
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).messages).toEqual(originalMessages);
    });
  });

  describe("conversation setup", () => {
    it("calls setupConversation and returns roomId", async () => {
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-room-id",
        memoryId: "memory-id",
      });

      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).roomId).toBe("generated-room-id");
    });

    it("passes roomId to setupConversation when provided", async () => {
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-id",
        memoryId: "memory-id",
      });

      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
        roomId: "existing-room-id",
      });

      await validateChatRequestX402(request as any);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: "existing-room-id",
        }),
      );
    });

    it("passes artistId to setupConversation when provided", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
        artistId: "artist-xyz",
      });

      await validateChatRequestX402(request as any);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: "artist-xyz",
        }),
      );
    });
  });

  describe("optional fields", () => {
    it("passes through model selection", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
        model: "gpt-4",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).model).toBe("gpt-4");
    });

    it("passes through excludeTools array", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
        excludeTools: ["tool1", "tool2"],
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).excludeTools).toEqual(["tool1", "tool2"]);
    });
  });

  describe("authToken handling", () => {
    it("sets authToken to undefined since x402 payment is the auth", async () => {
      const request = createMockRequest({
        accountId: "account-123",
        prompt: "Hello",
      });

      const result = await validateChatRequestX402(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).authToken).toBeUndefined();
    });
  });

  describe("chatRequestX402Schema", () => {
    it("exports the schema for external validation", () => {
      expect(chatRequestX402Schema).toBeDefined();
      const result = chatRequestX402Schema.safeParse({
        accountId: "account-123",
        prompt: "test",
      });
      expect(result.success).toBe(true);
    });

    it("schema requires accountId", () => {
      const result = chatRequestX402Schema.safeParse({ prompt: "test" });
      expect(result.success).toBe(false);
    });

    it("schema enforces mutual exclusivity of messages and prompt", () => {
      const result = chatRequestX402Schema.safeParse({
        accountId: "account-123",
        messages: [{ role: "user", content: "test" }],
        prompt: "test",
      });
      expect(result.success).toBe(false);
    });
  });
});
