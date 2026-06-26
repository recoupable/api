import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectAccountInfo } from "@/lib/supabase/account_info/selectAccountInfo";
import { getAccountWithDetails } from "@/lib/supabase/accounts/getAccountWithDetails";
import { getKnowledgeBaseText } from "@/lib/files/getKnowledgeBaseText";
import { getCreditUsage } from "@/lib/credits/getCreditUsage";
import { recordCreditDeduction } from "@/lib/credits/recordCreditDeduction";
import { handleChatCredits } from "@/lib/credits/handleChatCredits";
import { validateChatRequest } from "../../validateChatRequest";
import { setupChatRequest } from "../../setupChatRequest";

vi.mock("@/lib/credits/ensureCreditsOrShortCircuit", () => ({
  ensureCreditsOrShortCircuit: vi.fn().mockResolvedValue(null),
}));

/**
 * Integration tests for chat endpoints.
 *
 * These tests verify the end-to-end chat flow including:
 * 1. Request validation through the validation + auth flow
 * 2. Setup chat request with agent, tools, and system prompt
 * 3. Credit deduction handling (handleChatCredits)
 *
 * External dependencies (database, AI providers) are mocked to test
 * the integration of internal components.
 */

// Mock auth dependencies
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
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

// Mock room/memory dependencies (transitively reached via setupConversation
// → createNewRoom; mocked here so the real Supabase client never loads).
vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/rooms/upsertRoom", () => ({
  upsertRoom: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/insertMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/messages/filterMessageContentForMemories", () => ({
  default: vi.fn((msg: unknown) => msg),
}));

// Mock notification dependencies
vi.mock("@/lib/telegram/sendNewConversationNotification", () => ({
  sendNewConversationNotification: vi.fn(),
}));

vi.mock("@/lib/telegram/sendErrorNotification", () => ({
  sendErrorNotification: vi.fn(),
}));

// Mock chat title generation
vi.mock("@/lib/chat/generateChatTitle", () => ({
  generateChatTitle: vi.fn().mockResolvedValue("Test Chat"),
}));

// Mock room creation dependencies (for auto-create roomId)
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

vi.mock("@/lib/chat/saveChatCompletion", () => ({
  saveChatCompletion: vi.fn(),
}));

// Mock credit dependencies
vi.mock("@/lib/credits/getCreditUsage", () => ({
  getCreditUsage: vi.fn().mockResolvedValue(0.1),
}));

vi.mock("@/lib/credits/recordCreditDeduction", () => ({
  recordCreditDeduction: vi.fn(),
}));

// Mock tools setup
vi.mock("@/lib/chat/setupToolsForRequest", () => ({
  setupToolsForRequest: vi.fn().mockResolvedValue({}),
}));

// Mock internal AI text generation
vi.mock("@/lib/ai/generateText", () => ({
  default: vi.fn().mockResolvedValue({ text: "Generated Title" }),
}));

// Mock AI SDK
vi.mock("ai", () => ({
  convertToModelMessages: vi.fn((messages: unknown[]) => messages),
  isStepCount: vi.fn().mockReturnValue(() => true),
  ToolLoopAgent: vi.fn().mockImplementation(() => ({
    stream: vi.fn(),
    tools: {},
  })),
}));

const mockValidateAuthContext = vi.mocked(validateAuthContext);
const mockSelectAccountEmails = vi.mocked(selectAccountEmails);
const mockSelectAccountInfo = vi.mocked(selectAccountInfo);
const mockGetAccountWithDetails = vi.mocked(getAccountWithDetails);
const mockGetKnowledgeBaseText = vi.mocked(getKnowledgeBaseText);
const mockGetCreditUsage = vi.mocked(getCreditUsage);
const mockRecordCreditDeduction = vi.mocked(recordCreditDeduction);

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

describe("Chat Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mocks for Supabase operations
    mockSelectAccountEmails.mockResolvedValue([{ email: "test@example.com" }] as any);
    mockSelectAccountInfo.mockResolvedValue(null);
    mockGetAccountWithDetails.mockResolvedValue(null);
    mockGetKnowledgeBaseText.mockResolvedValue("");
    mockGetCreditUsage.mockResolvedValue(0.1);
    mockRecordCreditDeduction.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateChatRequest integration", () => {
    it("validates and returns body for valid request with prompt", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ prompt: "Hello" }, { "x-api-key": "valid-key" });

      const result = await validateChatRequest(request as any);

      // Should not be a NextResponse error
      expect(result).not.toBeInstanceOf(NextResponse);
      expect((result as any).accountId).toBe("account-123");
      expect((result as any).prompt).toBe("Hello");
    });

    it("validates and returns body for valid request with messages", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

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

    it("returns 401 when auth fails", async () => {
      mockValidateAuthContext.mockResolvedValue(
        NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
      );
      const request = createMockRequest({ prompt: "Hello" }, {});

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(401);
    });

    it("returns 400 when neither messages nor prompt is provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ roomId: "room-123" }, { "x-api-key": "valid-key" });

      const result = await validateChatRequest(request as any);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });

    it("returns 400 when both prompt and messages are provided", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

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
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

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

    it("returns ChatConfig with agent and messages", async () => {
      const body = {
        accountId: "account-123",
        messages: [{ id: "msg-1", role: "user", content: "Hello" }],
      };

      const result = await setupChatRequest(body as any);

      expect(result).toHaveProperty("agent");
      expect(result).toHaveProperty("messages");
      expect(Object.keys(result)).toEqual(["agent", "messages"]);
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

  describe("handleChatCredits integration", () => {
    it("calculates and deducts credits based on usage", async () => {
      mockGetCreditUsage.mockResolvedValue(0.5);

      const usage = {
        inputTokens: 1000,
        outputTokens: 500,
        inputTokenDetails: { cacheReadTokens: 0 },
      };
      await handleChatCredits({
        usage: usage as never,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalledWith(usage, "gpt-4", undefined);
      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "account-123",
          creditsToDeduct: 50, // 0.5 * 100
          source: "web",
        }),
      );
    });

    it("skips deduction when no accountId is provided", async () => {
      await handleChatCredits({
        usage: { promptTokens: 100, completionTokens: 50 },
        model: "gpt-4",
        accountId: undefined,
      });

      expect(mockGetCreditUsage).not.toHaveBeenCalled();
      expect(mockRecordCreditDeduction).not.toHaveBeenCalled();
    });

    it("deducts minimum 1 credit when cost is zero", async () => {
      mockGetCreditUsage.mockResolvedValue(0);
      mockRecordCreditDeduction.mockResolvedValue({ success: true, newBalance: 332 });

      await handleChatCredits({
        usage: { inputTokens: 10, outputTokens: 5, inputTokenDetails: { cacheReadTokens: 0 } } as never,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockGetCreditUsage).toHaveBeenCalled();
      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "account-123", creditsToDeduct: 1, source: "web" }),
      );
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
        usage: { inputTokens: 5, outputTokens: 5, inputTokenDetails: { cacheReadTokens: 0 } } as never,
        model: "gpt-4",
        accountId: "account-123",
      });

      expect(mockRecordCreditDeduction).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "account-123",
          creditsToDeduct: 1, // Math.max(1, Math.round(0.001 * 100))
          source: "web",
        }),
      );
    });
  });

  describe("end-to-end validation flow", () => {
    it("validates prompt-based requests through full pipeline", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

      const request = createMockRequest({ prompt: "What is 2+2?" }, { "x-api-key": "valid-key" });

      const validationResult = await validateChatRequest(request as any);
      expect(validationResult).not.toBeInstanceOf(NextResponse);

      const chatConfig = await setupChatRequest(validationResult as any);
      expect(chatConfig.agent).toBeDefined();
      expect(chatConfig.messages).toBeDefined();
    });

    it("validates messages-based requests through full pipeline", async () => {
      mockValidateAuthContext.mockResolvedValue({
        accountId: "account-123",
        orgId: null,
        authToken: "token",
      });

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
  });
});
