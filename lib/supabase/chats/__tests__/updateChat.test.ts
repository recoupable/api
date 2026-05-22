import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateChat } from "@/lib/supabase/chats/updateChat";

const updateChain = vi.fn();
const eqChain = vi.fn();
const matchChain = vi.fn();
const isChain = vi.fn();
const selectChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ update: updateChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Fluent builder mock — every method returns the same builder so we can
  // chain .eq / .match / .is / .select in any order without per-step setup.
  const builder = { eq: eqChain, match: matchChain, is: isChain, select: selectChain };
  updateChain.mockReturnValue(builder);
  eqChain.mockReturnValue(builder);
  matchChain.mockReturnValue(builder);
  isChain.mockReturnValue(builder);
});

describe("updateChat", () => {
  describe("plain update (no where predicate)", () => {
    it("returns ok:true with rowsUpdated and the row on success", async () => {
      const row = { id: "chat-1", title: "renamed" };
      selectChain.mockResolvedValue({ data: [row], error: null });
      const result = await updateChat({ id: "chat-1" }, { title: "renamed" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rowsUpdated).toBe(1);
      expect(result.row).toEqual(row);
      expect(updateChain).toHaveBeenCalledWith({ title: "renamed" });
      expect(eqChain).toHaveBeenCalledWith("id", "chat-1");
      // With no where filter, match is called with an empty object.
      expect(matchChain).toHaveBeenCalledWith({});
    });

    it("returns ok:false with error on Supabase failure", async () => {
      selectChain.mockResolvedValue({ data: null, error: { message: "down" } });
      const result = await updateChat({ id: "chat-x" }, { title: "x" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("down");
    });
  });

  describe("generic where predicate", () => {
    it("emits `is null` for null values (e.g. CAS expecting unset)", async () => {
      selectChain.mockResolvedValue({ data: [{ id: "c-1" }], error: null });
      await updateChat(
        { id: "c-1", where: { active_stream_id: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(isChain).toHaveBeenCalledWith("active_stream_id", null);
      // No non-null fields → match called with empty {}
      expect(matchChain).toHaveBeenCalledWith({});
    });

    it("emits `match()` for non-null values (e.g. CAS expecting a specific run id)", async () => {
      selectChain.mockResolvedValue({ data: [{ id: "c-1" }], error: null });
      await updateChat(
        { id: "c-1", where: { active_stream_id: "wrun_old" } },
        { active_stream_id: "wrun_new" },
      );
      expect(matchChain).toHaveBeenCalledWith({ active_stream_id: "wrun_old" });
      // No null fields → is() not called
      expect(isChain).not.toHaveBeenCalled();
    });

    it("AND-s nullable + equality where columns together", async () => {
      selectChain.mockResolvedValue({ data: [{ id: "c-1" }], error: null });
      await updateChat(
        { id: "c-1", where: { active_stream_id: null, model_id: "anthropic/claude-haiku-4.5" } },
        { title: "x" },
      );
      expect(isChain).toHaveBeenCalledWith("active_stream_id", null);
      expect(matchChain).toHaveBeenCalledWith({ model_id: "anthropic/claude-haiku-4.5" });
    });

    it("returns ok:true rowsUpdated:0 when the predicate matches no row (race lost)", async () => {
      selectChain.mockResolvedValue({ data: [], error: null });
      const result = await updateChat(
        { id: "c-1", where: { active_stream_id: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(result).toEqual(expect.objectContaining({ ok: true, rowsUpdated: 0 }));
    });

    it("differentiates 'race lost' (ok:true,rows:0) from 'DB error' (ok:false)", async () => {
      selectChain.mockResolvedValueOnce({ data: [], error: null });
      const raceLost = await updateChat(
        { id: "c-1", where: { active_stream_id: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(raceLost).toEqual(expect.objectContaining({ ok: true, rowsUpdated: 0 }));

      selectChain.mockResolvedValueOnce({ data: null, error: { message: "down" } });
      const dbError = await updateChat(
        { id: "c-1", where: { active_stream_id: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(dbError).toEqual(expect.objectContaining({ ok: false, error: "down" }));
    });
  });
});
