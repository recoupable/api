import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

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

vi.mock("@/lib/chat/setupConversation", () => ({
  setupConversation: vi.fn().mockResolvedValue({ roomId: "mock-room-id", memoryId: "mock-memory-id" }),
}));

vi.mock("@/lib/chat/validateMessages", () => ({
  validateMessages: vi.fn((messages) => ({
    lastMessage: messages[messages.length - 1] || { id: "mock-id", role: "user", parts: [] },
    validMessages: messages,
  })),
}));

vi.mock("@/lib/messages/convertToUiMessages", () => ({
  default: vi.fn((messages) => messages),
}));

vi.mock("@/lib/chat/setupChatRequest", () => ({
  setupChatRequest: vi.fn(),
}));

vi.mock("@/lib/chat/handleChatCompletion", () => ({
  handleChatCompletion: vi.fn(),
}));

vi.mock("ai", () => ({
  createUIMessageStream: vi.fn(),
  createUIMessageStreamResponse: vi.fn(),
}));

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateOverrideAccountId } from "@/lib/accounts/validateOverrideAccountId";
import { setupChatRequest } from "@/lib/chat/setupChatRequest";
import { setupConversation } from "@/lib/chat/setupConversation";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatStream } from "../handleChatStream";

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockValidateOverrideAccountId = vi.mocked(validateOverrideAccountId);
const mockSetupConversation = vi.mocked(setupConversation);
const mockSetupChatRequest = vi.mocked(setupChatRequest);
const mockCreateUIMessageStream = vi.mocked(createUIMessageStream);
const mockCreateUIMessageStreamResponse = vi.mocked(createUIMessageStreamResponse);

// Helper to create mock NextRequest
function createMockRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] || null,
      has: (key: string) => key.toLowerCase() in headers,
    },
  } as unknown as Request;
}

describe("handleChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock return value after clearAllMocks
    // Return the provided roomId if given, otherwise return mock-room-id
    mockSetupConversation.mockImplementation(async ({ roomId }) => ({
      roomId: roomId || "mock-room-id",
      memoryId: "mock-memory-id",
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 error when neither messages nor prompt is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { roomId: "room-123" },
        { "x-api-key": "test-key" },
      );

      const result = await handleChatStream(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.status).toBe("error");
    });

    it("returns 401 error when no auth header is provided", async () => {
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await handleChatStream(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(401);
      const json = await result.json();
      expect(json.message).toBe("Exactly one of x-api-key or Authorization must be provided");
    });
  });

  describe("streaming", () => {
    it("creates a streaming response for valid requests", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = {
        stream: vi.fn().mockResolvedValue({
          toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
          usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        }),
        tools: {},
      };

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "You are a helpful assistant",
        system: "You are a helpful assistant",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
        providerOptions: {},
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);

      const mockResponse = new Response(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(mockResponse);

      const request = createMockRequest(
        { prompt: "Hello, world!" },
        { "x-api-key": "valid-key" },
      );

      const result = await handleChatStream(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalled();
      expect(mockCreateUIMessageStream).toHaveBeenCalled();
      expect(mockCreateUIMessageStreamResponse).toHaveBeenCalledWith({
        stream: mockStream,
      });
      expect(result).toBe(mockResponse);
    });

    it("uses messages array when provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = {
        stream: vi.fn().mockResolvedValue({
          toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
          usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        }),
        tools: {},
      };

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "gpt-4",
        instructions: "You are a helpful assistant",
        system: "You are a helpful assistant",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
        providerOptions: {},
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(new Response(mockStream));

      const messages = [{ role: "user", content: "Hello" }];
      const request = createMockRequest(
        { messages },
        { "x-api-key": "valid-key" },
      );

      await handleChatStream(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          messages,
          accountId: "account-123",
        }),
      );
    });

    it("passes through optional parameters", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const mockAgent = {
        stream: vi.fn().mockResolvedValue({
          toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
          usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        }),
        tools: {},
      };

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        model: "claude-3-opus",
        instructions: "You are a helpful assistant",
        system: "You are a helpful assistant",
        messages: [],
        experimental_generateMessageId: vi.fn(),
        tools: {},
        providerOptions: {},
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(new Response(mockStream));

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

      await handleChatStream(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: "room-xyz",
          artistId: "artist-abc",
          model: "claude-3-opus",
          excludeTools: ["tool1"],
        }),
      );
    });
  });

  describe("error handling", () => {
    it("returns 500 error when setupChatRequest fails", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSetupChatRequest.mockRejectedValue(new Error("Setup failed"));

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "valid-key" },
      );

      const result = await handleChatStream(request as any);

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

      const mockAgent = {
        stream: vi.fn().mockResolvedValue({
          toUIMessageStream: vi.fn().mockReturnValue(new ReadableStream()),
          usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        }),
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
        providerOptions: {},
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(new Response(mockStream));

      const request = createMockRequest(
        { prompt: "Hello", accountId: "target-account-456" },
        { "x-api-key": "org-api-key" },
      );

      await handleChatStream(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "target-account-456",
        }),
      );
    });
  });
});
