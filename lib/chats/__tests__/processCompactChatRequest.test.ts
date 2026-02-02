import { describe, it, expect, vi, beforeEach } from "vitest";
import { processCompactChatRequest } from "../processCompactChatRequest";

const mockSelectRoom = vi.fn();
const mockCanAccessAccount = vi.fn();
const mockCompactChat = vi.fn();

vi.mock("@/lib/supabase/rooms/selectRoom", () => ({
  default: (...args: unknown[]) => mockSelectRoom(...args),
}));

vi.mock("@/lib/organizations/canAccessAccount", () => ({
  canAccessAccount: (...args: unknown[]) => mockCanAccessAccount(...args),
}));

vi.mock("../compactChat", () => ({
  compactChat: (...args: unknown[]) => mockCompactChat(...args),
}));

describe("processCompactChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("chat not found", () => {
    it("returns notFound when chat does not exist", async () => {
      mockSelectRoom.mockResolvedValue(null);

      const result = await processCompactChatRequest({
        chatId: "chat-123",
        accountId: "account-123",
      });

      expect(result).toEqual({ type: "notFound", chatId: "chat-123" });
      expect(mockSelectRoom).toHaveBeenCalledWith("chat-123");
    });
  });

  describe("access control", () => {
    it("returns notFound when user does not own chat and has no org access", async () => {
      mockSelectRoom.mockResolvedValue({
        id: "chat-123",
        account_id: "other-account",
      });
      mockCanAccessAccount.mockResolvedValue(false);

      const result = await processCompactChatRequest({
        chatId: "chat-123",
        accountId: "account-123",
        orgId: undefined,
      });

      expect(result).toEqual({ type: "notFound", chatId: "chat-123" });
      expect(mockCanAccessAccount).toHaveBeenCalledWith({
        orgId: undefined,
        targetAccountId: "other-account",
      });
    });

    it("allows access when user owns the chat", async () => {
      mockSelectRoom.mockResolvedValue({
        id: "chat-123",
        account_id: "account-123",
      });
      mockCompactChat.mockResolvedValue({
        chatId: "chat-123",
        compacted: "Summary",
      });

      const result = await processCompactChatRequest({
        chatId: "chat-123",
        accountId: "account-123",
      });

      expect(result.type).toBe("success");
      expect(mockCanAccessAccount).not.toHaveBeenCalled();
    });

    it("allows access when org has access to the chat owner", async () => {
      mockSelectRoom.mockResolvedValue({
        id: "chat-123",
        account_id: "member-account",
      });
      mockCanAccessAccount.mockResolvedValue(true);
      mockCompactChat.mockResolvedValue({
        chatId: "chat-123",
        compacted: "Summary",
      });

      const result = await processCompactChatRequest({
        chatId: "chat-123",
        accountId: "org-account",
        orgId: "org-123",
      });

      expect(result.type).toBe("success");
      expect(mockCanAccessAccount).toHaveBeenCalledWith({
        orgId: "org-123",
        targetAccountId: "member-account",
      });
    });

    it("allows access when chat has no account_id", async () => {
      mockSelectRoom.mockResolvedValue({
        id: "chat-123",
        account_id: null,
      });
      mockCompactChat.mockResolvedValue({
        chatId: "chat-123",
        compacted: "Summary",
      });

      const result = await processCompactChatRequest({
        chatId: "chat-123",
        accountId: "account-123",
      });

      expect(result.type).toBe("success");
      expect(mockCanAccessAccount).not.toHaveBeenCalled();
    });
  });

  describe("successful compaction", () => {
    it("returns success with compacted result", async () => {
      mockSelectRoom.mockResolvedValue({
        id: "chat-123",
        account_id: "account-123",
      });
      mockCompactChat.mockResolvedValue({
        chatId: "chat-123",
        compacted: "This is a summary of the conversation.",
      });

      const result = await processCompactChatRequest({
        chatId: "chat-123",
        accountId: "account-123",
      });

      expect(result).toEqual({
        type: "success",
        result: {
          chatId: "chat-123",
          compacted: "This is a summary of the conversation.",
        },
      });
    });

    it("passes custom prompt to compactChat", async () => {
      mockSelectRoom.mockResolvedValue({
        id: "chat-123",
        account_id: "account-123",
      });
      mockCompactChat.mockResolvedValue({
        chatId: "chat-123",
        compacted: "Action items only",
      });

      await processCompactChatRequest({
        chatId: "chat-123",
        prompt: "Focus on action items",
        accountId: "account-123",
      });

      expect(mockCompactChat).toHaveBeenCalledWith("chat-123", "Focus on action items");
    });
  });
});
