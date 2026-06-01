import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertChatMessages } from "@/lib/supabase/chat_messages/upsertChatMessages";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";

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
  it("returns 0 without calling the helper for an empty batch", async () => {
    const n = await upsertChatMessages([]);
    expect(n).toBe(0);
    expect(upsertChatMessage).not.toHaveBeenCalled();
  });

  it("delegates each row write-once to the single-row helper", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: null,
      isDuplicate: false,
    } as any);

    const n = await upsertChatMessages(rows);

    expect(n).toBe(2);
    expect(upsertChatMessage).toHaveBeenCalledTimes(2);
    expect(upsertChatMessage).toHaveBeenCalledWith(rows[0], { update: false });
  });

  it("counts duplicates (write-once skips) as success", async () => {
    vi.mocked(upsertChatMessage).mockResolvedValue({
      ok: true,
      row: null,
      isDuplicate: true,
    } as any);

    const n = await upsertChatMessages(rows);

    expect(n).toBe(2);
  });

  it("logs and keeps going on a row failure, then throws at the end", async () => {
    vi.mocked(upsertChatMessage)
      .mockResolvedValueOnce({ ok: true, row: null, isDuplicate: false } as any)
      .mockResolvedValueOnce({ ok: false, error: "row boom" } as any);

    await expect(upsertChatMessages(rows)).rejects.toThrow("Failed to upsert 1 of 2 chat_messages");
    expect(upsertChatMessage).toHaveBeenCalledTimes(2);
  });
});
