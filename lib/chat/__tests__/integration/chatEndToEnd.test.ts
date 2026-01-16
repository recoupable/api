import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Integration tests for chat endpoints.
 *
 * These tests verify the end-to-end chat flow including:
 * 1. Request validation through the validation + auth flow
 * 2. Setup chat request with agent, tools, and system prompt
 * 3. Post-completion handling (handleChatCompletion, handleChatCredits)
 * 4. Tool chains preparation
 *
 * External dependencies (database, AI providers) are mocked to test
 * the integration of internal components.
 */

// Mock auth dependencies
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

// Mock Supabase dependencies
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/account_info/selectAccountInfo", () => ({
  selectAccountInfo: vi.fn(),
}));

vi.mock("@/lib/supabase/accounts/getAccountWithDetails", () => ({
  getAccountWithDetails: vi.fn(),
}));

vi.mock("@/lib/files/getKnowledgeBaseText", () => ({
  getKnowledgeBaseText: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/insertRoom", () => ({
  insertRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/upsertMemory", () => ({
  default: vi.fn(),
}));

// Mock notification dependencies
vi.mock("@/lib/telegram/sendNewConversationNotification", () => ({
  sendNewConversationNotification: vi.fn(),
}));

vi.mock("@/lib/telegram/sendErrorNotification", () => ({
  sendErrorNotification: vi.fn(),
}));

// Mock email dependencies
vi.mock("@/lib/emails/handleSendEmailToolOutputs", () => ({
  handleSendEmailToolOutputs: vi.fn(),
}));

// Mock credit dependencies
vi.mock("@/lib/credits/getCreditUsage", () => ({
  getCreditUsage: vi.fn().mockResolvedValue(0.1),
}));

vi.mock("@/lib/credits/deductCredits", () => ({
  deductCredits: vi.fn(),
}));

// Mock tools setup
vi.mock("@/lib/chat/setupToolsForRequest", () => ({
  setupToolsForRequest: vi.fn().mockResolvedValue({}),
}));

// Mock internal AI text generation
vi.mock("@/lib/ai/generateText", () => ({
  default: vi.fn().mockResolvedValue({ text: "Generated Title" }),
}));

// Mock chat title generation
vi.mock("@/lib/chat/generateChatTitle", () => ({
  generateChatTitle: vi.fn().mockResolvedValue("Test Chat"),
}));

// Mock AI SDK
vi.mock("ai", () => ({
  convertToModelMessages: vi.fn((messages: unknown[]) => messages),
  stepCountIs: vi.fn().mockReturnValue(() => true),
  ToolLoopAgent: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    tools: {},
  })),
}));

import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { getKnowledgeBaseText } from "@/lib/files/getKnowledgeBaseText";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import upsertMemory from "@/lib/supabase/memories/upsertMemory";
import { sendNewConversationNotification } from "@/lib/telegram/sendNewConversationNotification";
import { handleSendEmailToolOutputs } from "@/lib/emails/handleSendEmailToolOutputs";
import { getCreditUsage } from "@/lib/credits/getCreditUsage";
import { deductCredits } from "@/lib/credits/deductCredits";
import { generateChatTitle } from "../../generateChatTitle";
import { handleChatCompletion } from "../../handleChatCompletion";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { validateChatRequest } from "../../validateChatRequest";
import { setupChatRequest } from "../../setupChatRequest";

const mockGetApiKeyAccountId = vi.mocked(getApiKeyAccountId);
const mockSelectAccountEmails = vi.mocked(selectAccountEmails);
const mockSelectAccountInfo = vi.mocked(selectAccountInfo);
const mockGetAccountWithDetails = vi.mocked(getAccountWithDetails);
const mockGetKnowledgeBaseText = vi.mocked(getKnowledgeBaseText);
const mockSelectRoom = vi.mocked(selectRoom);
const mockInsertRoom = vi.mocked(insertRoom);
const mockUpsertMemory = vi.mocked(upsertMemory);
const mockSendNewConversationNotification = vi.mocked(sendNewConversationNotification);
const mockHandleSendEmailToolOutputs = vi.mocked(handleSendEmailToolOutputs);
const mockGetCreditUsage = vi.mocked(getCreditUsage);
const mockDeductCredits = vi.mocked(deductCredits);
const mockGenerateChatTitle = vi.mocked(generateChatTitle);

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

describe("Chat Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks for Supabase operations
    mockSelectAccountEmails.mockResolvedValue([{ email: "test@example.com" }] as any);
    mockSelectAccountInfo.mockResolvedValue(null);
    mockGetAccountWithDetails.mockResolvedValue(null);
    mockGetKnowledgeBaseText.mockResolvedValue("");
    mockSelectRoom.mockResolvedValue(null);
    mockInsertRoom.mockResolvedValue(undefined);
    mockUpsertMemory.mockResolvedValue(undefined);
    mockSendNewConversationNotification.mockResolvedValue(undefined);
    mockHandleSendEmailToolOutputs.mockResolvedValue(undefined);
    mockGetCreditUsage.mockResolvedValue(0.1);
    mockDeductCredits.mockResolvedValue(undefined);
    mockGenerateChatTitle.mockResolvedValue("Test Chat");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateChatRequest integration", () => {
    it("validates and returns body for valid request with prompt", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "valid-key" },
      );

      const result = await validateChatRequest(request as any);

      // Should not be a NextResponse error
      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
      expect((result as any).prompt).toBe("Hello");
    });

    it("validates and returns body for valid request with messages", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        {
          messages: [{ id: "msg-1", role: "user", content: "Hello" }],
        },
        { "x-api-key": "valid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).messages).toHaveLength(1);
    });

    it("returns 401 when no auth header is provided", async () => {
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it("returns 401 when API key lookup fails", async () => {
      // getApiKeyAccountId returns a NextResponse when authentication fails
      mockGetApiKeyAccountId.mockResolvedValue(
        NextResponse.json(
          { status: "error", message: "Unauthorized" },
          { status: 401 },
        ),
      );

      const request = createMockRequest(
        { prompt: "Hello" },
        { "x-api-key": "invalid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it("returns 400 when neither messages nor prompt is provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { roomId: "room-123" },
        { "x-api-key": "valid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when both prompt and messages are provided", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        {
          prompt: "Hello",
          messages: [{ id: "msg-1", role: "user", content: "Hello" }],
        },
        { "x-api-key": "valid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("passes through optional parameters", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        {
          prompt: "Hello",
          roomId: "room-123",
          artistId: "artist-456",
          model: "gpt-4",
          excludeTools: ["tool1", "tool2"],
        },
        { "x-api-key": "valid-key" },
      );

      const result = await validateChatRequest(request as any);

      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).roomId).toBe("room-123");
      expect((result as any).artistId).toBe("artist-456");
      expect((result as any).model).toBe("gpt-4");
      expect((result as any).excludeTools).toEqual(["tool1", "tool2"]);
    });
  });

  describe("setupChatRequest integration", () => {
    it("correctly retrieves account email for system prompt", async () => {
      mockSelectAccountEmails.mockResolvedValue([{ email: "user@test.com" }] as any);

      const body = {
        accountId: "account-123",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body as any);

      expect(mockSelectAccountEmails).toHaveBeenCalledWith({
        accountIds: "account-123",
      });
    });

    it("fetches artist context when artistId is provided", async () => {
      mockSelectAccountInfo.mockResolvedValue({
        instruction: "Be helpful for this artist",
        knowledges: [{ id: "kb-1" }],
      } as any);
      mockGetKnowledgeBaseText.mockResolvedValue("Artist knowledge base content");

      const body = {
        accountId: "account-123",
        artistId: "artist-456",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body as any);

      expect(mockSelectAccountInfo).toHaveBeenCalledWith("artist-456");
      expect(mockGetKnowledgeBaseText).toHaveBeenCalled();
    });

    it("does not fetch artist context when artistId is not provided", async () => {
      const body = {
        accountId: "account-123",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body as any);

      expect(mockSelectAccountInfo).not.toHaveBeenCalled();
      expect(mockGetKnowledgeBaseText).not.toHaveBeenCalled();
    });

    it("returns ChatConfig with agent and tools", async () => {
      const body = {
        accountId: "account-123",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body as any);

      expect(result).toHaveProperty("agent");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("instructions");
      expect(result).toHaveProperty("tools");
      expect(result).toHaveProperty("system");
    });

    it("uses provided model override", async () => {
      const body = {
        accountId: "account-123",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
        model: "claude-3-opus",
      };

      const result = await setupChatRequest(body as any);

      expect(result.model).toBe("claude-3-opus");
    });

    it("fetches account details for system prompt context", async () => {
      mockGetAccountWithDetails.mockResolvedValue({
        name: "Test User",
        professional_context: "Music producer",
      } as any);

      const body = {
        accountId: "account-123",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
      };

      await setupChatRequest(body as any);

      expect(mockGetAccountWithDetails).toHaveBeenCalledWith("account-123");
    });
  });

  describe("handleChatCompletion integration", () => {
    it("creates room for new conversations", async () => {
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("New Chat Title");

      const body = {
        messages: [
          { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
        ],
        roomId: "new-room-123",
        accountId: "account-123",
      };

      const responseMessages = [
        { id: "response-1", role: "assistant", parts: [{ type: "text", text: "Hi there!" }] },
      ];

      await handleChatCompletion(body as any, responseMessages as any);

      expect(mockInsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new-room-123",
          account_id: "account-123",
          topic: "New Chat Title",
        }),
      );
      expect(mockSendNewConversationNotification).toHaveBeenCalled();
    });

    it("skips room creation for existing rooms", async () => {
      mockSelectRoom.mockResolvedValue({ id: "existing-room" } as any);

      const body = {
        messages: [
          { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
        ],
        roomId: "existing-room",
        accountId: "account-123",
      };

      const responseMessages = [
        { id: "response-1", role: "assistant", parts: [{ type: "text", text: "Hi!" }] },
      ];

      await handleChatCompletion(body as any, responseMessages as any);

      expect(mockInsertRoom).not.toHaveBeenCalled();
      expect(mockSendNewConversationNotification).not.toHaveBeenCalled();
    });

    it("stores both user and assistant messages to memories", async () => {
      mockSelectRoom.mockResolvedValue({ id: "room-123" } as any);

      const body = {
        messages: [
          { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
        ],
        roomId: "room-123",
        accountId: "account-123",
      };

      const responseMessages = [
        { id: "response-1", role: "assistant", parts: [{ type: "text", text: "Hi!" }] },
      ];

      await handleChatCompletion(body as any, responseMessages as any);

      expect(mockUpsertMemory).toHaveBeenCalledTimes(2);
      expect(mockUpsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-1",
          room_id: "room-123",
        }),
      );
      expect(mockUpsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "response-1",
          room_id: "room-123",
        }),
      );
    });

    it("processes email tool outputs", async () => {
      mockSelectRoom.mockResolvedValue({ id: "room-123" } as any);

      const body = {
        messages: [
          { id: "msg-1", role: "user", parts: [{ type: "text", text: "Send an email" }] },
        ],
        roomId: "room-123",
        accountId: "account-123",
      };

      const responseMessages = [
        {
          id: "response-1",
          role: "assistant",
          parts: [
            {
              type: "tool-invocation",
              toolName: "send_email",
              result: { success: true },
            },
          ],
        },
      ];

      await handleChatCompletion(body as any, responseMessages as any);

      expect(mockHandleSendEmailToolOutputs).toHaveBeenCalledWith(responseMessages);
    });

    it("catches errors without breaking chat response", async () => {
      mockSelectRoom.mockRejectedValue(new Error("Database error"));

      const body = {
        messages: [
          { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
        ],
        roomId: "room-123",
        accountId: "account-123",
      };

      const responseMessages = [
        { id: "response-1", role: "assistant", parts: [{ type: "text", text: "Hi!" }] },
      ];

      // Should not throw
      await expect(
        handleChatCompletion(body as any, responseMessages as any),
      ).resolves.toBeUndefined();
    });

    it("handles empty roomId by defaulting to empty string", async () => {
      const body = {
        messages: [
          { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
        ],
        accountId: "account-123",
        // roomId not provided
      };

      const responseMessages = [
        { id: "response-1", role: "assistant", parts: [{ type: "text", text: "Hi!" }] },
      ];

      await handleChatCompletion(body as any, responseMessages as any);

      expect(mockSelectRoom).toHaveBeenCalledWith("");
    });
  });

  describe("handleChatCredits integration", () => {
    it("calculates and deducts credits based on usage", async () => {
      mockGetCreditUsage.mockResolvedValue(0.5);

      await handleChatCredits({
        usage: { promptTokens: 1000, completionTokens: 500 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalledWith(
        { promptTokens: 1000, completionTokens: 500 },
        "gpt-4",
      );
      expect(mockDeductCredits).toHaveBeenCalledWith({
        accountId: "account-123",
        creditsToDeduct: 50, // 0.5 * 100
      });
    });

    it("skips deduction when no accountId is provided", async () => {
      await handleChatCredits({
        usage: { promptTokens: 100, completionTokens: 50 },
        model: "gpt-4",
        accountId: undefined,
      });

      expect(mockGetCreditUsage).not.toHaveBeenCalled();
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it("handles zero cost gracefully", async () => {
      mockGetCreditUsage.mockResolvedValue(0);

      await handleChatCredits({
        usage: { promptTokens: 10, completionTokens: 5 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalled();
      expect(mockDeductCredits).not.toHaveBeenCalled();
    });

    it("catches credit deduction errors without breaking chat flow", async () => {
      mockGetCreditUsage.mockRejectedValue(new Error("Gateway error"));

      // Should not throw
      await expect(
        handleChatCredits({
          usage: { promptTokens: 100, completionTokens: 50 },
          model: "gpt-4",
          accountId: "account-123",
        }),
      ).resolves.toBeUndefined();
    });

    it("rounds credits to minimum of 1 when cost is very small", async () => {
      mockGetCreditUsage.mockResolvedValue(0.001);

      await handleChatCredits({
        usage: { promptTokens: 5, completionTokens: 5 },
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockDeductCredits).toHaveBeenCalledWith({
        accountId: "account-123",
        creditsToDeduct: 1, // Math.max(1, Math.round(0.001 * 100))
      });
    });
  });

  describe("end-to-end validation flow", () => {
    it("validates prompt-based requests through full pipeline", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        { prompt: "What is 2+2?" },
        { "x-api-key": "valid-key" },
      );

      const validationResult = await validateChatRequest(request as any);
      expect(validationResult).not.toBeInstanceOf(NextResponse);

      const chatConfig = await setupChatRequest(validationResult as any);
      expect(chatConfig.agent).toBeDefined();
      expect(chatConfig.model).toBeDefined();
    });

    it("validates messages-based requests through full pipeline", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");

      const request = createMockRequest(
        {
          messages: [
            { id: "msg-1", role: "user", content: "Hello" },
            { id: "msg-2", role: "assistant", content: "Hi there!" },
            { id: "msg-3", role: "user", content: "How are you?" },
          ],
        },
        { "x-api-key": "valid-key" },
      );

      const validationResult = await validateChatRequest(request as any);
      expect(validationResult).not.toBeInstanceOf(NextResponse);

      const chatConfig = await setupChatRequest(validationResult as any);
      expect(chatConfig.agent).toBeDefined();
      expect(chatConfig.messages.length).toBeLessThanOrEqual(100); // MAX_MESSAGES
    });

    it("handles complete chat flow with post-completion", async () => {
      mockGetApiKeyAccountId.mockResolvedValue("account-123");
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("Math Question");

      // 1. Validate request
      const request = createMockRequest(
        {
          prompt: "What is 2+2?",
          roomId: "new-room-123",
        },
        { "x-api-key": "valid-key" },
      );

      const body = await validateChatRequest(request as any);
      expect(body).not.toBeInstanceOf(NextResponse);

      // 2. Setup chat request
      const chatConfig = await setupChatRequest(body as any);
      expect(chatConfig.agent).toBeDefined();

      // 3. Handle post-completion (simulating what would happen after agent response)
      const responseMessages = [
        {
          id: "response-1",
          role: "assistant",
          parts: [{ type: "text", text: "2 + 2 = 4" }],
        },
      ];

      await handleChatCompletion(body as any, responseMessages as any);

      expect(mockInsertRoom).toHaveBeenCalled();
      expect(mockUpsertMemory).toHaveBeenCalledTimes(2);

      // 4. Handle credits
      await handleChatCredits({
        usage: { promptTokens: 100, completionTokens: 50 },
        model: chatConfig.model,
        accountId: (body as any).accountId,
      });

      expect(mockGetCreditUsage).toHaveBeenCalled();
      expect(mockDeductCredits).toHaveBeenCalled();
    });
  });
});
