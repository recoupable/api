import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { setupChatRequest } from "@/lib/chat/setupChatRequest";
import { saveChatCompletion } from "@/lib/chat/saveChatCompletion";
import { setupConversation } from "@/lib/chat/setupConversation";
import { handleChatGenerate } from "../handleChatGenerate";

// Mock all dependencies before importing the module under test
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

vi.mock("@/lib/chat/setupChatRequest", () => ({
  setupChatRequest: vi.fn(),
}));

vi.mock("@/lib/chat/saveChatCompletion", () => ({
  saveChatCompletion: vi.fn(),
}));

vi.mock("@/lib/uuid/generateUUID", () => {
  const mockFn = vi.fn(() => "auto-generated-room-id");
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

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockValidateOverrideAccountId = vi.mocked(validateOverrideAccountId);
const mockSetupChatRequest = vi.mocked(setupChatRequest);
const mockSaveChatCompletion = vi.mocked(saveChatCompletion);
const mockSetupConversation = vi.mocked(setupConversation);

// Helper to create a mock agent with .generate()
/**
 *
 * @param generateResult
 */
function createMockAgent(generateResult: Record<string, unknown>) {
  return {
    generate: vi.fn().mockResolvedValue(generateResult),
    stream: vi.fn(),
    tools: {},
  };
}

// Helper to create mock NextRequest
/**
 *
 * @param body
 * @param headers
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

describe("handleChatGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for setupConversation
    mockSetupConversation.mockResolvedValue({
      roomId: "auto-generated-room-id",
      memoryId: "auto-generated-memory-id",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 error when neither messages nor prompt is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest({ roomId: "room-123" }, { "x-api-key": "test-key" });

      const result = await handleChatGenerate(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.status).toBe("error");
    });

    it("returns 401 error when no auth header is provided", async () => {
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await handleChatGenerate(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(401);
      const json = await result.json();
      expect(json.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });
  });

  describe("text generation", () => {
    it("returns generated text using agent.generate() for valid requests", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = createMockAgent({
        text: "Hello! How can I help you?",
        reasoningText: undefined,
        sources: [],
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: {
          messages: [],
          headers: {},
          body: null,
        },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "You are a helpful assistant",
        system: "You are a helpful assistant",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      const request = createMockRequest({ prompt: "Hello, world!" }, { "x-api-key": "valid-key" });

      const result = await handleChatGenerate(request as any);

      expect(mockAgent.generate).toHaveBeenCalled();
      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.text).toBe("Hello! How can I help you?");
      expect(json.finishReason).toBe("stop");
      expect(json.usage).toEqual({ promptTokens: 10, completionTokens: 20 });
    });

    it("uses messages array when provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      const messages = [{ role: "user", content: "Hello" }];
      const request = createMockRequest({ messages }, { "x-api-key": "valid-key" });

      await handleChatGenerate(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          messages,
          accountId: "account-123",
        }),
      );
    });

    it("passes through optional parameters", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "room-xyz",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "claude-3-opus",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      const request = createMockRequest(
        {
          prompt: "Hello",
          roomId: "room-xyz",
          artistId: "artist-abc",
          model: "claude-3-opus",
          excludeTools: ["tool1"],
        },
        { "x-api-key": "valid-key" },
      );

      await handleChatGenerate(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: "room-xyz",
          artistId: "artist-abc",
          model: "claude-3-opus",
          excludeTools: ["tool1"],
        }),
      );
    });

    it("includes reasoningText when present", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = createMockAgent({
        text: "Response",
        reasoningText: "Let me think about this...",
        sources: [{ url: "https://example.com" }],
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await handleChatGenerate(request as any);

      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.reasoningText).toBe("Let me think about this...");
      expect(json.sources).toEqual([{ url: "https://example.com" }]);
    });
  });

  describe("error handling", () => {
    it("returns 500 error when setupChatRequest fails", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupChatRequest.mockRejectedValue(new Error("Setup failed"));

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await handleChatGenerate(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
      const json = await result.json();
      expect(json.status).toBe("error");
    });

    it("returns 500 error when agent.generate() fails", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = {
        generate: vi.fn().mockRejectedValue(new Error("Generation failed")),
        stream: vi.fn(),
        tools: {},
      };

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await handleChatGenerate(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
      const json = await result.json();
      expect(json.status).toBe("error");
    });
  });

  describe("accountId override", () => {
    it("allows org API key to override accountId", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("org-account-123");
      mockValidateOverrideAccountId.mockResolvedValue({
        accountId: "target-account-456",
      });

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-account-456" },
        { "x-api-key": "org-api-key" },
      );

      await handleChatGenerate(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "target-account-456",
        }),
      );
    });
  });

  describe("message persistence", () => {
    it("saves assistant message to database when roomId is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "room-abc-123",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "Hello! How can I help you?",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      mockSaveChatCompletion.mockResolvedValue(null);

      const request = createMockRequest(
        { prompt: "Hello", roomId: "room-abc-123" },
        { "x-api-key": "valid-key" },
      );

      await handleChatGenerate(request as any);

      expect(mockSaveChatCompletion).toHaveBeenCalledWith({
        text: "Hello! How can I help you?",
        roomId: "room-abc-123",
      });
    });

    it("saves message with auto-generated roomId when roomId is not provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "auto-generated-room-id",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      mockSaveChatCompletion.mockResolvedValue(null);

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      await handleChatGenerate(request as any);

      // Since roomId is auto-created, saveChatCompletion should be called
      expect(mockSaveChatCompletion).toHaveBeenCalledWith({
        text: "Response",
        roomId: "auto-generated-room-id",
      });
    });

    it("includes roomId in HTTP response when provided by client", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "client-provided-room-id",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      mockSaveChatCompletion.mockResolvedValue(null);

      const request = createMockRequest(
        { prompt: "Hello", roomId: "client-provided-room-id" },
        { "x-api-key": "valid-key" },
      );

      const result = await handleChatGenerate(request as any);

      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.roomId).toBe("client-provided-room-id");
    });

    it("includes auto-generated roomId in HTTP response when not provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "auto-generated-room-456",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      mockSaveChatCompletion.mockResolvedValue(null);

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await handleChatGenerate(request as any);

      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.roomId).toBe("auto-generated-room-456");
    });

    it("passes correct text to saveChatCompletion", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "room-xyz",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "This is the assistant response text",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      mockSaveChatCompletion.mockResolvedValue(null);

      const request = createMockRequest(
        { prompt: "Hello", roomId: "room-xyz" },
        { "x-api-key": "valid-key" },
      );

      await handleChatGenerate(request as any);

      expect(mockSaveChatCompletion).toHaveBeenCalledWith({
        text: "This is the assistant response text",
        roomId: "room-xyz",
      });
    });

    it("still returns success response even if saveChatCompletion fails", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupConversation.mockResolvedValue({
        roomId: "room-abc",
        memoryId: "memory-id",
      });

      const mockAgent = createMockAgent({
        text: "Response",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20 },
        response: { messages: [], headers: {}, body: null },
      });

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "test",
        system: "test",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
      } as any);

      mockSaveChatCompletion.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest(
        { prompt: "Hello", roomId: "room-abc" },
        { "x-api-key": "valid-key" },
      );

      const result = await handleChatGenerate(request as any);

      expect(result.status).toBe(200);
      const json = await result.json();
      expect(json.text).toBe("Response");
    });
  });
});
