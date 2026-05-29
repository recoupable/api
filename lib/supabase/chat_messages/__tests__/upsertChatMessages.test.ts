import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertChatMessages } from "@/lib/supabase/chat_messages/upsertChatMessages";

const upsertChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ upsert: upsertChain })),
  },
}));

const rows: any[] = [
  { id: "m1", chat_id: "c1", role: "user", parts: [], created_at: "t" },
  { id: "m2", chat_id: "c1", role: "assistant", parts: [], created_at: "t" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("upsertChatMessages", () => {
  it("returns 0 and does not query for an empty batch", async () => {
    const n = await upsertChatMessages([]);
    expect(n).toBe(0);
    expect(upsertChain).not.toHaveBeenCalled();
  });

  it("writes the whole batch in one round-trip on success", async () => {
    upsertChain.mockResolvedValueOnce({ error: null });

    const n = await upsertChatMessages(rows);

    expect(n).toBe(2);
    expect(upsertChain).toHaveBeenCalledTimes(1);
    expect(upsertChain).toHaveBeenCalledWith(rows, {
      onConflict: "id",
      ignoreDuplicates: true,
    });
  });

  it("falls back to per-row upserts when the batch fails", async () => {
    upsertChain
      .mockResolvedValueOnce({ error: { message: "batch boom" } }) // batch
      .mockResolvedValueOnce({ error: null }) // row m1
      .mockResolvedValueOnce({ error: null }); // row m2

    const n = await upsertChatMessages(rows);

    expect(n).toBe(2);
    expect(upsertChain).toHaveBeenCalledTimes(3);
  });

  it("throws when a row still fails after the per-row fallback", async () => {
    upsertChain
      .mockResolvedValueOnce({ error: { message: "batch boom" } })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "row boom" } });

    await expect(upsertChatMessages(rows)).rejects.toThrow("Failed to upsert 1 of 2 chat_messages");
  });
});
