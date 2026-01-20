import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { validateChatRequest, chatRequestSchema } from "../validateChatRequest";

// Mock dependencies
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({
  getApiKeyAccountId: vi.fn(),
}));

vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({
  getAuthenticatedAccountId: vi.fn(),
}));

vi.mock("@/lib/accounts/validateOverrideAccountId", () => ({
  validateOverrideAccountId: vi.fn(),
}));

vi.mock("@/lib/keys/getApiKeyDetails", () => ({
  getApiKeyDetails: vi.fn(),
}));

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
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

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { getApiKeyDetails } from "@/lib/keys/getApiKeyDetails";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { createNewRoom } from "@/lib/chat/createNewRoom";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import { setupConversation } from "@/lib/chat/setupConversation";

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockGetAuthenticatedAccountId = vi.mocked(getAuthenticatedAccountId);
const mockValidateOverrideAccountId = vi.mocked(validateOverrideAccountId);
const mockGetApiKeyDetails = vi.mocked(getApiKeyDetails);
const mockValidateOrganizationAccess = vi.mocked(validateOrganizationAccess);
const mockGenerateUUID = vi.mocked(generateUUID);
const mockCreateNewRoom = vi.mocked(createNewRoom);
const mockInsertMemories = vi.mocked(insertMemories);
const mockFilterMessageContentForMemories = vi.mocked(filterMessageContentForMemories);
const mockSetupConversation = vi.mocked(setupConversation);

// Helper to create mock NextRequest
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
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { roomId: "room-123" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("rejects when both messages and prompt are provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        {
          messages: [{ role: "user", content: "Hello" }],
          prompt: "Hello",
        },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Invalid input");
    });

    it("accepts valid messages array", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { messages: [{ role: "user", content: "Hello" }] },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
    });

    it("accepts valid prompt string", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "Hello, world!" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
    });
  });

  describe("authentication", () => {
    it("rejects request without any auth header", async () => {
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("rejects request with both x-api-key and Authorization headers", async () => {
      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "test-key", authorization: "Bearer test-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });

    it("rejects request with invalid API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Invalid API key" },
          { status: 401 },
        ),
      );

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "invalid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
    });

    it("uses accountId from valid API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-abc-123");

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "valid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-abc-123");
    });

    it("accepts valid Authorization Bearer token", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("account-from-jwt-456");

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-from-jwt-456");
    });

    it("rejects request with invalid Authorization token", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Failed to verify authentication token" },
          { status: 401 },
        ),
      );

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer invalid-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
    });

    it("returns orgId for org API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "org-account-123",
      });

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "org-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("org-account-123");
      expect((result as any).orgId).toBe("org-account-123");
    });

    it("returns null orgId for personal API key", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("personal-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "personal-account-123",
        orgId: null,
      });

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "personal-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("personal-account-123");
      expect((result as any).orgId).toBeNull();
    });

    it("returns null orgId for bearer token auth", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("jwt-account-456");

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("jwt-account-456");
      expect((result as any).orgId).toBeNull();
    });
  });

  describe("accountId override", () => {
    it("allows org API key to override accountId", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockValidateOverrideAccountId.mockResolvedValue({
        accountId: "target-account-456",
      });

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-account-456" },
        { "x-api-key": "org-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("target-account-456");
      expect(mockValidateOverrideAccountId).toHaveBeenCalledWith({
        apiKey: "org-api-key",
        targetAccountId: "target-account-456",
      });
    });

    it("rejects unauthorized accountId override", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("personal-account-123");
      mockValidateOverrideAccountId.mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Access denied to specified accountId" },
          { status: 403 },
        ),
      );

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-account-456" },
        { "x-api-key": "personal-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified accountId");
    });
  });

  describe("message normalization", () => {
    it("converts prompt to messages array", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "Hello, world!" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).messages).toHaveLength(1);
      expect((result as any).messages[0].role).toBe("user");
      expect((result as any).messages[0].parts[0].text).toBe("Hello, world!");
    });

    it("preserves original messages when provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const originalMessages = [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ];
      const request = createMockRequest(
        { messages: originalMessages },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).messages).toEqual(originalMessages);
    });
  });

  describe("optional fields", () => {
    it("passes through roomId", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "room-xyz",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", roomId: "room-xyz" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).roomId).toBe("room-xyz");
    });

    it("passes through artistId", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "Hello", artistId: "artist-abc" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).artistId).toBe("artist-abc");
    });

    it("passes through model selection", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "Hello", model: "gpt-4" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).model).toBe("gpt-4");
    });

    it("passes through excludeTools array", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "Hello", excludeTools: ["tool1", "tool2"] },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).excludeTools).toEqual(["tool1", "tool2"]);
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
  });

  describe("organizationId override", () => {
    it("accepts organizationId in schema", () => {
      const result = chatRequestSchema.safeParse({
        prompt: "test",
        organizationId: "org-123",
      });
      expect(result.success).toBe(true);
    });

    it("uses provided organizationId when user is member of org (bearer token)", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("user-account-123");
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "org-456" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("org-456");
      expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "user-account-123",
        organizationId: "org-456",
      });
    });

    it("uses provided organizationId when user is member of org (API key)", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("api-key-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "api-key-account-123",
        orgId: null,
      });
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "org-789" },
        { "x-api-key": "personal-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("org-789");
      expect(mockValidateOrganizationAccess).toHaveBeenCalledWith({
        accountId: "api-key-account-123",
        organizationId: "org-789",
      });
    });

    it("overwrites API key orgId with provided organizationId when user is member", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "original-org-123",
      });
      mockValidateOrganizationAccess.mockResolvedValue(true);

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "different-org-456" },
        { "x-api-key": "org-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("different-org-456");
    });

    it("rejects organizationId when user is NOT a member of org", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("user-account-123");
      mockValidateOrganizationAccess.mockResolvedValue(false);

      const request = createMockRequest(
        { prompt: "Hello", organizationId: "org-not-member" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      const json = await (result as NextResponse).json();
      expect(json.status).toBe("error");
      expect(json.message).toBe("Access denied to specified organizationId");
    });

    it("uses API key orgId when no organizationId is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockGetApiKeyDetails.mockResolvedValue({
        accountId: "org-account-123",
        orgId: "api-key-org-123",
      });

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "org-api-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBe("api-key-org-123");
      // Should not validate org access when no organizationId is provided
      expect(mockValidateOrganizationAccess).not.toHaveBeenCalled();
    });

    it("returns null orgId when no organizationId provided and bearer token auth", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("user-account-123");

      const request = createMockRequest(
        { prompt: "Hello" },
        { authorization: "Bearer valid-jwt-token" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).orgId).toBeNull();
      expect(mockValidateOrganizationAccess).not.toHaveBeenCalled();
    });
  });

  describe("auto room creation", () => {
    it("returns roomId from setupConversation when roomId is not provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-456",
        memoryId: "memory-id",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "test-key" });

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).roomId).toBe("generated-uuid-456");
    });

    it("calls setupConversation with correct params when roomId is not provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-789",
        memoryId: "memory-id",
      });

      const request = createMockRequest({ prompt: "Create a new room" }, { "x-api-key": "test-key" });

      await validateChatRequest(request as any);

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
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "generated-uuid-abc",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", artistId: "artist-xyz" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as any);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          artistId: "artist-xyz",
        }),
      );
    });

    it("returns provided roomId when roomId is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-123",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", roomId: "existing-room-123" },
        { "x-api-key": "test-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).roomId).toBe("existing-room-123");
    });

    it("passes roomId to setupConversation when provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-456",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello", roomId: "existing-room-456" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as any);

      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: "existing-room-456",
        }),
      );
    });

    it("works with bearer token auth for auto room creation", async () => {
      mockGetAuthenticatedAccountId.mockResolvedValue("jwt-account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "jwt-generated-uuid",
        memoryId: "memory-id",
      });

      const request = createMockRequest(
        { prompt: "Hello from JWT" },
        { authorization: "Bearer valid-jwt" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).roomId).toBe("jwt-generated-uuid");
      expect(mockSetupConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "jwt-account-123",
        }),
      );
    });

    it("calls setupConversation when roomId is auto-created", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "new-room-uuid",
        memoryId: "new-room-uuid",
      });

      const request = createMockRequest(
        { prompt: "This is my first message" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as any);

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
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "existing-room-id",
        memoryId: "memory-uuid",
      });

      const request = createMockRequest(
        { prompt: "Hello to existing room", roomId: "existing-room-id" },
        { "x-api-key": "test-key" },
      );

      await validateChatRequest(request as any);

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
