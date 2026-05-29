import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertChatMessages } from "@/lib/supabase/chat_messages/upsertChatMessages";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";

const upsertChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ upsert: upsertChain })),
  },
}));
vi.mock("@/lib/supabase/chat_messages/upsertChatMessage", () => ({
  upsertChatMessage: vi.fn(),
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
    expect(upsertChatMessage).not.toHaveBeenCalled();
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
    // No per-row work needed when the batch succeeds.
    expect(upsertChatMessage).not.toHaveBeenCalled();
  });

  it("falls back to the single-row helper when the batch fails", async () => {
    upsertChain.mockResolvedValueOnce({ error: { message: "batch boom" } });
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: null,
      isDuplicate: false,
    } as any);

    const n = await upsertChatMessages(rows);

    expect(n).toBe(2);
    expect(upsertChain).toHaveBeenCalledTimes(1); // batch attempt only
    expect(upsertChatMessage).toHaveBeenCalledTimes(2); // one per row
    expect(upsertChatMessage).toHaveBeenCalledWith(rows[0], { update: false });
  });

  it("throws when a row still fails after the per-row fallback", async () => {
    upsertChain.mockResolvedValueOnce({ error: { message: "batch boom" } });
    vi.mocked(upsertChatMessage)
      .mockResolvedValueOnce({ ok: true, row: null, isDuplicate: false } as any)
      .mockResolvedValueOnce({ ok: false, error: "row boom" } as any);

    await expect(upsertChatMessages(rows)).rejects.toThrow("Failed to upsert 1 of 2 chat_messages");
  });
});
