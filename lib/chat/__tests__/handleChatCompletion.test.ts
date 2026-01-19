import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UIMessage } from "ai";

// Mock all dependencies before importing the module under test
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({
  default: vi.fn(),
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

vi.mock("@/lib/telegram/sendNewConversationNotification", () => ({
  sendNewConversationNotification: vi.fn(),
}));

vi.mock("@/lib/chat/generateChatTitle", () => ({
  generateChatTitle: vi.fn(),
}));

vi.mock("@/lib/emails/handleSendEmailToolOutputs", () => ({
  handleSendEmailToolOutputs: vi.fn(),
}));

vi.mock("@/lib/telegram/sendErrorNotification", () => ({
  sendErrorNotification: vi.fn(),
}));

import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import selectRoom from "@/lib/supabase/rooms/selectRoom";
import { insertRoom } from "@/lib/supabase/rooms/insertRoom";
import upsertMemory from "@/lib/supabase/memories/upsertMemory";
import { sendNewConversationNotification } from "@/lib/telegram/sendNewConversationNotification";
import { generateChatTitle } from "@/lib/chat/generateChatTitle";
import { handleSendEmailToolOutputs } from "@/lib/emails/handleSendEmailToolOutputs";
import { sendErrorNotification } from "@/lib/telegram/sendErrorNotification";
import { handleChatCompletion } from "../handleChatCompletion";
import type { ChatRequestBody } from "../validateChatRequest";

const mockSelectAccountEmails = vi.mocked(selectAccountEmails);
const mockSelectRoom = vi.mocked(selectRoom);
const mockInsertRoom = vi.mocked(insertRoom);
const mockUpsertMemory = vi.mocked(upsertMemory);
const mockSendNewConversationNotification = vi.mocked(sendNewConversationNotification);
const mockGenerateChatTitle = vi.mocked(generateChatTitle);
const mockHandleSendEmailToolOutputs = vi.mocked(handleSendEmailToolOutputs);
const mockSendErrorNotification = vi.mocked(sendErrorNotification);

// Helper to create mock UIMessage
function createMockUIMessage(id: string, role: "user" | "assistant", text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text" as const, text }],
    createdAt: new Date(),
  };
}

// Helper to create mock ChatRequestBody
function createMockBody(overrides: Partial<ChatRequestBody> = {}): ChatRequestBody {
  return {
    accountId: "account-123",
    messages: [createMockUIMessage("msg-1", "user", "Hello")],
    roomId: "room-456",
    ...overrides,
  };
}

describe("handleChatCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockSelectAccountEmails.mockResolvedValue([]);
    mockSelectRoom.mockResolvedValue({ id: "room-456" });
    mockUpsertMemory.mockResolvedValue(null);
    mockHandleSendEmailToolOutputs.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("message storage", () => {
    it("stores user message to memories", async () => {
      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi there!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockUpsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "msg-1",
          room_id: "room-456",
        }),
      );
    });

    it("stores assistant message to memories", async () => {
      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi there!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockUpsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "resp-1",
          room_id: "room-456",
        }),
      );
    });

    it("stores messages sequentially (user then assistant)", async () => {
      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi there!")];

      const callOrder: string[] = [];
      mockUpsertMemory.mockImplementation(async (params) => {
        callOrder.push(params.id);
        return null;
      });

      await handleChatCompletion(body, responseMessages);

      expect(callOrder).toEqual(["msg-1", "resp-1"]);
    });
  });

  describe("new conversation handling", () => {
    it("creates room when room does not exist", async () => {
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("Test Topic");

      const body = createMockBody({ roomId: "new-room-123" });
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockInsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "new-room-123",
          account_id: "account-123",
          topic: "Test Topic",
        }),
      );
    });

    it("sends notification for new conversation", async () => {
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("Test Topic");
      mockSelectAccountEmails.mockResolvedValue([{ email: "test@example.com" } as any]);

      const body = createMockBody({ roomId: "new-room-123" });
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockSendNewConversationNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "account-123",
          email: "test@example.com",
          conversationId: "new-room-123",
          topic: "Test Topic",
        }),
      );
    });

    it("does not create room when room already exists", async () => {
      mockSelectRoom.mockResolvedValue({ id: "existing-room" });

      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockInsertRoom).not.toHaveBeenCalled();
      expect(mockSendNewConversationNotification).not.toHaveBeenCalled();
    });
  });

  describe("email handling", () => {
    it("processes email tool outputs from response messages", async () => {
      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Email sent!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockHandleSendEmailToolOutputs).toHaveBeenCalledWith(responseMessages);
    });
  });

  describe("account email lookup", () => {
    it("retrieves email for account", async () => {
      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockSelectAccountEmails).toHaveBeenCalledWith({
        accountIds: "account-123",
      });
    });

    it("uses first email from account emails", async () => {
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("Topic");
      mockSelectAccountEmails.mockResolvedValue([
        { email: "first@example.com" } as any,
        { email: "second@example.com" } as any,
      ]);

      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockSendNewConversationNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "first@example.com",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("sends error notification when an error occurs", async () => {
      const testError = new Error("Storage failed");
      mockUpsertMemory.mockRejectedValue(testError);

      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockSendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/chat",
          error: expect.objectContaining({
            name: "Error",
            message: "Storage failed",
          }),
        }),
      );
    });

    it("does not throw when error occurs (graceful handling)", async () => {
      mockUpsertMemory.mockRejectedValue(new Error("DB error"));

      const body = createMockBody();
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      // Should not throw
      await expect(handleChatCompletion(body, responseMessages)).resolves.toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles empty roomId", async () => {
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("Topic");

      const body = createMockBody({ roomId: "" });
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      // Should still create room with empty string ID (or undefined)
      expect(mockInsertRoom).toHaveBeenCalled();
    });

    it("handles artistId when creating room", async () => {
      mockSelectRoom.mockResolvedValue(null);
      mockGenerateChatTitle.mockResolvedValue("Topic");

      const body = createMockBody({ roomId: "new-room", artistId: "artist-789" });
      const responseMessages = [createMockUIMessage("resp-1", "assistant", "Hi!")];

      await handleChatCompletion(body, responseMessages);

      expect(mockInsertRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          artist_id: "artist-789",
        }),
      );
    });

    it("handles multiple response messages (uses last one)", async () => {
      const body = createMockBody();
      const responseMessages = [
        createMockUIMessage("resp-1", "assistant", "First"),
        createMockUIMessage("resp-2", "assistant", "Second"),
      ];

      await handleChatCompletion(body, responseMessages);

      // Should store the last response message
      expect(mockUpsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "resp-2",
        }),
      );
    });
  });
});
