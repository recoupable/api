import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteTrailingChatMessages } from "@/lib/supabase/chat_messages/deleteTrailingChatMessages";

const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();

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
const boundary = {
  id: "123e4567-e89b-42d3-a456-426614174001",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("deleteTrailingChatMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes trailing rows with a single scoped delete", async () => {
    mockOr.mockResolvedValue({ error: null });

    const result = await deleteTrailingChatMessages(chatId, boundary);

    expect(result).toBe(true);
    expect(mockEq).toHaveBeenCalledWith("chat_id", chatId);
    expect(mockOr).toHaveBeenCalledWith(
      `created_at.gt."${boundary.createdAt}",and(created_at.eq."${boundary.createdAt}",id.gte.${boundary.id})`,
    );
  });

  it("returns false when Supabase delete fails", async () => {
    mockOr.mockResolvedValue({ error: { message: "delete failed" } });

    const result = await deleteTrailingChatMessages(chatId, boundary);
    expect(result).toBe(false);
  });
});
