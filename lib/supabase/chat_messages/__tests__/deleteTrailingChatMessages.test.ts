import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTrailingChatMessages } from "@/lib/supabase/chat_messages/deleteTrailingChatMessages";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();

vi.mock("@/lib/supabase/chat_messages/selectChatMessages", () => ({
  selectChatMessages: vi.fn(),
}));

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      delete: (...args: unknown[]) => {
        mockDelete(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { or: (...orArgs: unknown[]) => mockOr(...orArgs) };
          },
        };
      },
    })),
  },
}));

const chatId = "123e4567-e89b-42d3-a456-426614174000";
const boundaryMessageId = "123e4567-e89b-42d3-a456-426614174001";
const boundaryCreatedAt = "2026-01-01T00:00:00.000Z";

describe("deleteTrailingChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when boundary lookup fails", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue(null);

    const result = await deleteTrailingChatMessages(chatId, boundaryMessageId);
    expect(result).toBe(false);
    expect(mockOr).not.toHaveBeenCalled();
  });

  it("returns false when boundary message is missing", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue([]);

    const result = await deleteTrailingChatMessages(chatId, boundaryMessageId);
    expect(result).toBe(false);
    expect(mockOr).not.toHaveBeenCalled();
  });

  it("deletes trailing rows with a single scoped delete", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue([
      {
        id: boundaryMessageId,
        chat_id: chatId,
        created_at: boundaryCreatedAt,
      } as never,
    ]);
    mockOr.mockResolvedValue({ error: null });

    const result = await deleteTrailingChatMessages(chatId, boundaryMessageId);

    expect(result).toBe(true);
    expect(selectChatMessages).toHaveBeenCalledWith({
      chatId,
      id: boundaryMessageId,
      limit: 1,
    });
    expect(mockEq).toHaveBeenCalledWith("chat_id", chatId);
    expect(mockOr).toHaveBeenCalledWith(
      `created_at.gt."${boundaryCreatedAt}",and(created_at.eq."${boundaryCreatedAt}",id.gte.${boundaryMessageId})`,
    );
  });

  it("returns false when Supabase delete fails", async () => {
    vi.mocked(selectChatMessages).mockResolvedValue([
      {
        id: boundaryMessageId,
        chat_id: chatId,
        created_at: boundaryCreatedAt,
      } as never,
    ]);
    mockOr.mockResolvedValue({ error: { message: "delete failed" } });

    const result = await deleteTrailingChatMessages(chatId, boundaryMessageId);
    expect(result).toBe(false);
  });
});
