import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getMessages } from "@/lib/messages/getMessages";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import { saveChatCompletion } from "../saveChatCompletion";

// Mock dependencies before importing the module under test
vi.mock("@/lib/messages/getMessages", () => ({
  getMessages: vi.fn(),
}));

vi.mock("@/lib/messages/filterMessageContentForMemories", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/supabase/memories/insertMemories", () => ({
  default: vi.fn(),
}));

const mockGetMessages = vi.mocked(getMessages);
const mockFilterMessageContentForMemories = vi.mocked(filterMessageContentForMemories);
const mockInsertMemories = vi.mocked(insertMemories);

describe("saveChatCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls getMessages with text and role", async () => {
    const mockMessage = {
      id: "msg-123",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Hello, world!" }],
    };
    mockGetMessages.mockReturnValue([mockMessage]);
    mockFilterMessageContentForMemories.mockReturnValue({
      role: "assistant",
      parts: mockMessage.parts,
      content: "Hello, world!",
    });
    mockInsertMemories.mockResolvedValue(null);

    await saveChatCompletion({
      text: "Hello, world!",
      role: "assistant",
      roomId: "room-abc",
    });

    expect(mockGetMessages).toHaveBeenCalledWith("Hello, world!", "assistant");
  });

  it("calls filterMessageContentForMemories with the message", async () => {
    const mockMessage = {
      id: "msg-456",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Test response" }],
    };
    mockGetMessages.mockReturnValue([mockMessage]);
    mockFilterMessageContentForMemories.mockReturnValue({
      role: "assistant",
      parts: mockMessage.parts,
      content: "Test response",
    });
    mockInsertMemories.mockResolvedValue(null);

    await saveChatCompletion({
      text: "Test response",
      role: "assistant",
      roomId: "room-xyz",
    });

    expect(mockFilterMessageContentForMemories).toHaveBeenCalledWith(mockMessage);
  });

  it("calls insertMemories with id, room_id, and filtered content", async () => {
    const mockMessage = {
      id: "msg-789",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "AI response" }],
    };
    const mockFilteredContent = {
      role: "assistant",
      parts: mockMessage.parts,
      content: "AI response",
    };
    mockGetMessages.mockReturnValue([mockMessage]);
    mockFilterMessageContentForMemories.mockReturnValue(mockFilteredContent);
    mockInsertMemories.mockResolvedValue(null);

    await saveChatCompletion({
      text: "AI response",
      role: "assistant",
      roomId: "room-123",
    });

    expect(mockInsertMemories).toHaveBeenCalledWith({
      id: "msg-789",
      room_id: "room-123",
      content: mockFilteredContent,
    });
  });

  it("uses 'assistant' as default role when not specified", async () => {
    const mockMessage = {
      id: "msg-default",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Default role test" }],
    };
    mockGetMessages.mockReturnValue([mockMessage]);
    mockFilterMessageContentForMemories.mockReturnValue({
      role: "assistant",
      parts: mockMessage.parts,
      content: "Default role test",
    });
    mockInsertMemories.mockResolvedValue(null);

    await saveChatCompletion({
      text: "Default role test",
      roomId: "room-default",
    });

    expect(mockGetMessages).toHaveBeenCalledWith("Default role test", "assistant");
  });

  it("returns the inserted memory", async () => {
    const mockMessage = {
      id: "msg-return",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Return test" }],
    };
    const mockFilteredContent = {
      role: "assistant",
      parts: mockMessage.parts,
      content: "Return test",
    };
    const mockInsertedMemory = {
      id: "msg-return",
      room_id: "room-return",
      content: mockFilteredContent,
      created_at: "2026-01-19T00:00:00Z",
    };
    mockGetMessages.mockReturnValue([mockMessage]);
    mockFilterMessageContentForMemories.mockReturnValue(mockFilteredContent);
    mockInsertMemories.mockResolvedValue(mockInsertedMemory as any);

    const result = await saveChatCompletion({
      text: "Return test",
      roomId: "room-return",
    });

    expect(result).toEqual(mockInsertedMemory);
  });

  it("propagates errors from insertMemories", async () => {
    const mockMessage = {
      id: "msg-error",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "Error test" }],
    };
    mockGetMessages.mockReturnValue([mockMessage]);
    mockFilterMessageContentForMemories.mockReturnValue({
      role: "assistant",
      parts: mockMessage.parts,
      content: "Error test",
    });
    mockInsertMemories.mockRejectedValue(new Error("Database error"));

    await expect(
      saveChatCompletion({
        text: "Error test",
        roomId: "room-error",
      }),
    ).rejects.toThrow("Database error");
  });
});
