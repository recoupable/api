import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateChat } from "@/lib/supabase/chats/updateChat";

const updateChain = vi.fn();
const eqIdChain = vi.fn();
const eqStreamChain = vi.fn();
const isStreamChain = vi.fn();
const selectChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ update: updateChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  updateChain.mockReturnValue({ eq: eqIdChain });
  eqIdChain.mockReturnValue({
    eq: eqStreamChain,
    is: isStreamChain,
    select: selectChain,
  });
  eqStreamChain.mockReturnValue({ select: selectChain });
  isStreamChain.mockReturnValue({ select: selectChain });
});

describe("updateChat", () => {
  describe("plain update (no predicate)", () => {
    it("returns ok:true with rowsUpdated and the row on success", async () => {
      const row = { id: "chat-1", title: "renamed" };
      selectChain.mockResolvedValue({ data: [row], error: null });
      const result = await updateChat({ id: "chat-1" }, { title: "renamed" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rowsUpdated).toBe(1);
      expect(result.row).toEqual(row);
      expect(updateChain).toHaveBeenCalledWith({ title: "renamed" });
      expect(eqIdChain).toHaveBeenCalledWith("id", "chat-1");
    });

    it("returns ok:false with error on Supabase failure", async () => {
      selectChain.mockResolvedValue({ data: null, error: { message: "down" } });
      const result = await updateChat({ id: "chat-x" }, { title: "x" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe("down");
    });
  });

  describe("CAS predicate (whereActiveStreamId)", () => {
    it("applies `is null` predicate when whereActiveStreamId.equals is null", async () => {
      selectChain.mockResolvedValue({ data: [{ id: "chat-1" }], error: null });
      const result = await updateChat(
        { id: "chat-1", whereActiveStreamId: { equals: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rowsUpdated).toBe(1);
      expect(isStreamChain).toHaveBeenCalledWith("active_stream_id", null);
    });

    it("applies `eq` predicate when whereActiveStreamId.equals is a string", async () => {
      selectChain.mockResolvedValue({ data: [{ id: "chat-1" }], error: null });
      await updateChat(
        { id: "chat-1", whereActiveStreamId: { equals: "wrun_old" } },
        { active_stream_id: "wrun_new" },
      );
      expect(eqStreamChain).toHaveBeenCalledWith("active_stream_id", "wrun_old");
    });

    it("returns ok:true rowsUpdated:0 when the predicate matches no row (race lost)", async () => {
      selectChain.mockResolvedValue({ data: [], error: null });
      const result = await updateChat(
        { id: "chat-1", whereActiveStreamId: { equals: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.rowsUpdated).toBe(0);
    });

    it("differentiates 'race lost' (ok:true,rows:0) from 'DB error' (ok:false)", async () => {
      // race lost
      selectChain.mockResolvedValueOnce({ data: [], error: null });
      const raceLost = await updateChat(
        { id: "chat-1", whereActiveStreamId: { equals: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(raceLost).toEqual(expect.objectContaining({ ok: true, rowsUpdated: 0 }));

      // DB error
      selectChain.mockResolvedValueOnce({ data: null, error: { message: "down" } });
      const dbError = await updateChat(
        { id: "chat-1", whereActiveStreamId: { equals: null } },
        { active_stream_id: "wrun_x" },
      );
      expect(dbError).toEqual(expect.objectContaining({ ok: false, error: "down" }));
    });
  });
});
