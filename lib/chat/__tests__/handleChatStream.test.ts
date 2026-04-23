import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { setupChatRequest } from "@/lib/chat/setupChatRequest";
import { setupConversation } from "@/lib/chat/setupConversation";
import { handleChatCompletion } from "@/lib/chat/handleChatCompletion";
import { handleCreateArtistRedirect } from "@/lib/chat/handleCreateArtistRedirect";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { handleChatStream } from "../handleChatStream";

// Mock all dependencies before importing the module under test
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/chat/setupConversation", () => ({
  setupConversation: vi
    .fn()
    .mockResolvedValue({ roomId: "mock-room-id", memoryId: "mock-memory-id" }),
}));

vi.mock("@/lib/chat/validateMessages", () => ({
  validateMessages: vi.fn(messages => ({
    lastMessage: messages[messages.length - 1] || { id: "mock-id", role: "user", parts: [] },
    validMessages: messages,
  })),
}));

vi.mock("@/lib/messages/convertToUiMessages", () => ({
  default: vi.fn(messages => messages),
}));

vi.mock("@/lib/chat/setupChatRequest", () => ({
  setupChatRequest: vi.fn(),
}));

vi.mock("@/lib/chat/handleChatCompletion", () => ({
  handleChatCompletion: vi.fn(),
}));

vi.mock("@/lib/chat/handleCreateArtistRedirect", () => ({
  handleCreateArtistRedirect: vi.fn(),
}));

vi.mock("@/lib/credits/handleChatCredits", () => ({
  handleChatCredits: vi.fn(),
}));

vi.mock("@/lib/const", () => ({
  DEFAULT_MODEL: "openai/gpt-5-mini",
}));

vi.mock("ai", () => ({
  createUIMessageStream: vi.fn(),
  createUIMessageStreamResponse: vi.fn(),
}));

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockSetupConversation = vi.mocked(setupConversation);
const mockSetupChatRequest = vi.mocked(setupChatRequest);
const mockHandleChatCompletion = vi.mocked(handleChatCompletion);
const mockHandleCreateArtistRedirect = vi.mocked(handleCreateArtistRedirect);
const mockCreateUIMessageStream = vi.mocked(createUIMessageStream);
const mockCreateUIMessageStreamResponse = vi.mocked(createUIMessageStreamResponse);

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

describe("handleChatStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup mock return value after clearAllMocks
    // Return the provided roomId if given, otherwise return mock-room-id
    mockSetupConversation.mockImplementation(async ({ roomId }) => ({
      roomId: roomId || "mock-room-id",
      memoryId: "mock-memory-id",
    }));
    mockHandleChatCompletion.mockResolvedValue();
    mockHandleCreateArtistRedirect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validation", () => {
    it("returns 400 error when neither messages nor prompt is provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ roomId: "room-123" }, { "x-api-key": "test-key" });

      const result = await handleChatStream(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(400);
      const json = await result.json();
      expect(json.status).toBe("error");
    });

    it("returns 401 error when no auth header is provided", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await handleChatStream(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(401);
    });
  });

  describe("streaming", () => {
    it("creates a streaming response for valid requests", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
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
        messages: [],
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);

      const mockResponse = new Response(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(mockResponse);

      const request = createMockRequest({ prompt: "Hello, world!" }, { "x-api-key": "valid-key" });

      const result = await handleChatStream(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalled();
      expect(mockCreateUIMessageStream).toHaveBeenCalled();
      expect(mockCreateUIMessageStreamResponse).toHaveBeenCalledWith({
        stream: mockStream,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With, x-api-key",
        },
      });
      expect(result).toBe(mockResponse);
    });

    it("uses messages array when provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
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
        messages: [],
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(new Response(mockStream));

      const messages = [{ role: "user", content: "Hello" }];
      const request = createMockRequest({ messages }, { "x-api-key": "valid-key" });

      await handleChatStream(request as any);

      expect(mockSetupChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          messages,
          accountId: "account-123",
        }),
      );
    });

    it("passes through optional parameters", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
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
        messages: [],
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

    it("uses sendFinish false and emits redirect data after completion", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      const toUIMessageStream = vi.fn().mockReturnValue(new ReadableStream());
      const mockAgent = {
        stream: vi.fn().mockResolvedValue({
          toUIMessageStream,
          usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
        }),
        tools: {},
      };

      mockSetupChatRequest.mockResolvedValue({
        agent: mockAgent,
        messages: [],
      } as any);

      const mockStream = new ReadableStream();
      mockCreateUIMessageStream.mockReturnValue(mockStream);
      mockCreateUIMessageStreamResponse.mockReturnValue(new Response(mockStream));

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      await handleChatStream(request as any, async ({ body, responseMessages, writer }) => {
        const redirectPath = await handleCreateArtistRedirect(body, responseMessages);
        if (!redirectPath) {
          return;
        }

        writer.write({
          type: "data-redirect",
          data: { path: redirectPath },
          transient: true,
        });
      });

      mockHandleCreateArtistRedirect.mockResolvedValue("/chat/new-room-123");

      const execute = mockCreateUIMessageStream.mock.calls[0][0].execute;
      const writer = {
        merge: vi.fn(),
        write: vi.fn(),
        onError: undefined,
      };

      await execute({ writer } as any);

      expect(toUIMessageStream).toHaveBeenCalledWith(
        expect.objectContaining({
          sendFinish: false,
          onFinish: expect.any(Function),
        }),
      );

      const onFinish = toUIMessageStream.mock.calls[0][0].onFinish;
      await onFinish({
        isAborted: false,
        finishReason: "stop",
        messages: [{ id: "resp-1", role: "assistant", parts: [] }],
        responseMessage: { id: "resp-1", role: "assistant", parts: [] },
        isContinuation: false,
      });

      expect(writer.write).toHaveBeenCalledWith({
        type: "data-redirect",
        data: { path: "/chat/new-room-123" },
        transient: true,
      });
      expect(writer.write).toHaveBeenCalledWith({
        type: "finish",
        finishReason: "stop",
      });
    });
  });

  describe("error handling", () => {
    it("returns 500 error when setupChatRequest fails", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });
      mockSetupChatRequest.mockRejectedValue(new Error("Setup failed"));

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await handleChatStream(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect(result.status).toBe(500);
      const json = await result.json();
      expect(json.status).toBe("error");
    });
  });

  describe("accountId override", () => {
    it("allows accountId override", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "target-account-456",
        orgId: null,
        authToken: "token",
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
        messages: [],
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
