import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateChatRequest, chatRequestSchema } from "../validateChatRequest";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { setupConversation } from "@/lib/chat/setupConversation";

// Mock dependencies
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/uuid/generateUUID", () => {
  const mockFn = vi.fn(() => "mock-uuid-default");
  return {
    generateUUID: mockFn,
    default: mockFn,
  };
});

vi.mock("@/lib/chat/createNewRoom", () => ({
  createNewRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/insertMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/messages/filterMessageContentForMemories", () => ({
  default: vi.fn((msg: unknown) => msg),
}));

vi.mock("@/lib/chat/setupConversation", () => ({
  setupConversation: vi.fn(),
}));

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockSetupConversation = vi.mocked(setupConversation);

// Helper to create mock NextRequest
/**
 * Create Mock Request.
 *
 * @param body - Request payload.
 * @param headers - Headers for the request.
 * @returns - Computed result.
 */
function createMockRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
      has: (key: string) => key.toLowerCase() in headers,
    },
  } as unknown as Request;
}

describe("validateChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for setupConversation returns generated roomId and memoryId
    mockSetupConversation.mockResolvedValue({
      roomId: "mock-uuid-default",
      memoryId: "mock-uuid-default",
    });
  });

  describe("schema validation", () => {
    it("rejects when neither messages nor prompt is provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ roomId: "room-123" }, { "x-api-key": "test-key" });

      const result = await validateChatRequest(request as unknown);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("rejects when both messages and prompt are provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest(
        {
          messages: [{ role: "user", content: "Hello" }],
          prompt: "Hello",
        },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("accepts valid messages array", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest(
        { messages: [{ role: "user", content: "Hello" }] },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).accountId).toBe("account-123");
    });

    it("accepts valid prompt string", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ prompt: "Hello, world!" }, { "x-api-key": "test-key" });

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).accountId).toBe("account-123");
    });
  });

  describe("authentication", () => {
    it("rejects request without any auth header", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json(
          { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
          { status: 401 },
        ),
      );
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await validateChatRequest(request as unknown);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.error).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("returns auth error when validateAuthContext fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
      );

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "invalid-key" });
      const result = await validateChatRequest(request as unknown);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it("uses accountId from validateAuthContext", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "resolved-account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });
      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).accountId).toBe("resolved-account-123");
    });

    it("passes accountId and organizationId to validateAuthContext", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "target-456",
        orgId: "org-789",
        authToken: "token",
      });

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-456", organizationId: "org-789" },
        { "x-api-key": "valid-key" },
      );
      await validateChatRequest(request as unknown);

      expect(mockValidateAuthContext).toHaveBeenCalledWith(expect.anything(), {
        accountId: "target-456",
        organizationId: "org-789",
      });
    });
  });

  describe("message normalization", () => {
    it("converts prompt to messages array", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ prompt: "Hello, world!" }, { "x-api-key": "test-key" });

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).messages).toHaveLength(1);
      expect((result as unknown).messages[0].role).toBe("user");
      expect((result as unknown).messages[0].parts[0].text).toBe("Hello, world!");
    });

    it("preserves original messages when provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const originalMessages = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];
      const request = createMockRequest(
        { messages: originalMessages },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).messages).toEqual(originalMessages);
    });
  });

  describe("optional fields", () => {
    it("passes through roomId", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "room-xyz",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", roomId: "room-xyz" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).roomId).toBe("room-xyz");
    });

    it("passes through artistId", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest(
        { prompt: "Hello", artistId: "artist-abc" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).artistId).toBe("artist-abc");
    });

    it("passes through model selection", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest(
        { prompt: "Hello", model: "gpt-4" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).model).toBe("gpt-4");
    });

    it("passes through excludeTools array", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest(
        { prompt: "Hello", excludeTools: ["tool1", "tool2"] },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).excludeTools).toEqual(["tool1", "tool2"]);
    });

    it("passes through topic", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest(
        { prompt: "Hello", topic: "Pulse Feb 2" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).topic).toBe("Pulse Feb 2");
    });
  });

  describe("chatRequestSchema", () => {
    it("exports the schema for external validation", () => {
      expect(chatRequestSchema).toBeDefined();
      const result = chatRequestSchema.safeParse({ prompt: "test" });
      expect(result.success).toBe(true);
    });

    it("schema validates messages array type", () => {
      const result = chatRequestSchema.safeParse({
        messages: [{ role: "user", content: "test" }],
      });
      expect(result.success).toBe(true);
    });

    it("schema enforces mutual exclusivity", () => {
      const result = chatRequestSchema.safeParse({
        messages: [{ role: "user", content: "test" }],
        prompt: "test",
      });
      expect(result.success).toBe(false);
    });

    it("schema accepts optional topic string", () => {
      const result = chatRequestSchema.safeParse({
        prompt: "test",
        topic: "Pulse Feb 2",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("organizationId override", () => {
    it("accepts organizationId in schema", () => {
      const result = chatRequestSchema.safeParse({
        prompt: "test",
        organizationId: "org-123",
      });
      expect(result.success).toBe(true);
    });

    it("uses orgId from validateAuthContext when organizationId is provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: "org-456",
        authToken: "token",
      });

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "org-456" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).orgId).toBe("org-456");
    });

    it("returns null orgId when no organizationId provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "test-key" });

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).orgId).toBeNull();
    });
  });

  describe("auto room creation", () => {
    it("returns roomId from setupConversation when roomId is not provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-456",
        memoryId: "memory-id",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "test-key" });

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).roomId).toBe("generated-uuid-456");
    });

    it("calls setupConversation with correct params when roomId is not provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-789",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Create a new room" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as unknown);

      expect(mockSetupConversation).toHaveBeenCalledWith({
        accountId: "account-123",
        roomId: undefined,
        promptMessage: expect.objectContaining({
          role: "user",
          parts: expect.arrayContaining([expect.objectContaining({ text: "Create a new room" })]),
        }),
        artistId: undefined,
        memoryId: expect.any(String),
      });
    });

    it("passes artistId to setupConversation when provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-abc",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", artistId: "artist-xyz" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as unknown);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: "artist-xyz",
        }),
      );
    });

    it("passes topic to setupConversation when provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-topic",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", topic: "Pulse Feb 2" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as unknown);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "Pulse Feb 2",
        }),
      );
    });

    it("returns provided roomId when roomId is provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-123",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", roomId: "existing-room-123" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).roomId).toBe("existing-room-123");
    });

    it("passes roomId to setupConversation when provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-456",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", roomId: "existing-room-456" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as unknown);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: "existing-room-456",
        }),
      );
    });

    it("works with bearer token auth for auto room creation", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "jwt-account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "jwt-generated-uuid",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello from JWT" },
        { authorization: "Bearer valid-jwt" },
      );

      const result = await validateChatRequest(request as unknown);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as unknown).roomId).toBe("jwt-generated-uuid");
      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "jwt-account-123",
        }),
      );
    });

    it("calls setupConversation when roomId is auto-created", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "new-room-uuid",
        memoryId: "new-room-uuid",
      });

      const request = createMockRequest(
        { prompt: "This is my first message" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as unknown);

      expect(mockSetupConversation).toHaveBeenCalledWith({
        accountId: "account-123",
        roomId: undefined,
        promptMessage: expect.objectContaining({
          role: "user",
          parts: expect.arrayContaining([
            expect.objectContaining({ text: "This is my first message" }),
          ]),
        }),
        artistId: undefined,
        memoryId: expect.any(String),
      });
    });

    it("calls setupConversation for existing rooms", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-id",
        memoryId: "memory-uuid",
      });

      const request = createMockRequest(
        { prompt: "Hello to existing room", roomId: "existing-room-id" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as unknown);

      // setupConversation handles both new and existing rooms
      expect(mockSetupConversation).toHaveBeenCalledWith({
        accountId: "account-123",
        roomId: "existing-room-id",
        promptMessage: expect.objectContaining({
          role: "user",
          parts: expect.arrayContaining([
            expect.objectContaining({ text: "Hello to existing room" }),
          ]),
        }),
        artistId: undefined,
        memoryId: expect.any(String),
      });
    });
  });
});
