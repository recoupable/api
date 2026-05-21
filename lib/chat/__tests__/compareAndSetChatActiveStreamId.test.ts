import { describe, it, expect, vi, beforeEach } from "vitest";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { updateChat } from "@/lib/supabase/chats/updateChat";

vi.mock("@/lib/supabase/chats/updateChat", () => ({
  updateChat: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("compareAndSetChatActiveStreamId", () => {
  it("returns ok:true claimed:true when the row predicate matches and is updated", async () => {
    vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 1, row: null });
    const result = await compareAndSetChatActiveStreamId("chat-1", null, "wrun_x");
    expect(result).toEqual({ ok: true, claimed: true });
    expect(updateChat).toHaveBeenCalledWith(
      { id: "chat-1", where: { active_stream_id: null } },
      { active_stream_id: "wrun_x" },
    );
  });

  it("returns ok:true claimed:false when the predicate matches no rows (race lost)", async () => {
    vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 0, row: null });
    const result = await compareAndSetChatActiveStreamId("chat-1", null, "wrun_x");
    expect(result).toEqual({ ok: true, claimed: false });
  });

  it("returns ok:false with the underlying error on DB failure (distinct from race lost)", async () => {
    vi.mocked(updateChat).mockResolvedValue({ ok: false, error: "down" });
    const result = await compareAndSetChatActiveStreamId("chat-1", null, "wrun_x");
    expect(result).toEqual({ ok: false, error: "down" });
  });

  it("supports expecting a specific run id (placeholder → real promotion)", async () => {
    vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 1, row: null });
    await compareAndSetChatActiveStreamId("chat-1", "pending-abc", "wrun_real");
    expect(updateChat).toHaveBeenCalledWith(
      { id: "chat-1", where: { active_stream_id: "pending-abc" } },
      { active_stream_id: "wrun_real" },
    );
  });

  it("supports next=null (releasing the slot)", async () => {
    vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 1, row: null });
    await compareAndSetChatActiveStreamId("chat-1", "wrun_old", null);
    expect(updateChat).toHaveBeenCalledWith(
      { id: "chat-1", where: { active_stream_id: "wrun_old" } },
      { active_stream_id: null },
    );
  });
});
