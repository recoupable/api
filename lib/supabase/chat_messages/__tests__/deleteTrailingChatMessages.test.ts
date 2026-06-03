import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTrailingChatMessages } from "@/lib/supabase/chat_messages/deleteTrailingChatMessages";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

const mockDelete = vi.fn();
const mockIn = vi.fn();

vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      delete: (...args: unknown[]) => {
        mockDelete(...args);
        return { in: (...inArgs: unknown[]) => mockIn(...inArgs) };
      },
    })),
  },
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const firstMessageId = "123e4567-e89b-42d3-a456-426614174001";
const secondMessageId = "123e4567-e89b-42d3-a456-426614174002";

describe("deleteTrailingChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when boundary message is missing", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue([
      { id: firstMessageId, chat_id: chatId, created_at: "2026-01-01T00:00:00.000Z" } as never,
    ]);

    const result = await deleteTrailingChatMessages(chatId, secondMessageId);
    expect(result).toBe(false);
    expect(mockIn).not.toHaveBeenCalled();
  });

  it("deletes the boundary message and all newer messages", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue([
      { id: firstMessageId, chat_id: chatId, created_at: "2026-01-01T00:00:00.000Z" } as never,
      { id: secondMessageId, chat_id: chatId, created_at: "2026-01-01T00:00:01.000Z" } as never,
    ]);
    mockIn.mockResolvedValue({ error: null });

    const result = await deleteTrailingChatMessages(chatId, firstMessageId);

    expect(result).toBe(true);
    expect(mockIn).toHaveBeenCalledWith("id", [firstMessageId, secondMessageId]);
  });

  it("returns false when Supabase delete fails", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue([
      { id: firstMessageId, chat_id: chatId, created_at: "2026-01-01T00:00:00.000Z" } as never,
    ]);
    mockIn.mockResolvedValue({ error: { message: "delete failed" } });

    const result = await deleteTrailingChatMessages(chatId, firstMessageId);
    expect(result).toBe(false);
  });
});
