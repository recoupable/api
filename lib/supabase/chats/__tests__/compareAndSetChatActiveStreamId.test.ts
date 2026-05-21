import { describe, it, expect, vi, beforeEach } from "vitest";
import { compareAndSetChatActiveStreamId } from "@/lib/supabase/chats/compareAndSetChatActiveStreamId";

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
  eqIdChain.mockReturnValue({ eq: eqStreamChain, is: isStreamChain });
  eqStreamChain.mockReturnValue({ select: selectChain });
  isStreamChain.mockReturnValue({ select: selectChain });
});

describe("compareAndSetChatActiveStreamId", () => {
  it("returns true when the row update succeeds (expected=null)", async () => {
    selectChain.mockResolvedValue({ data: [{ id: "chat-1" }], error: null });
    const result = await compareAndSetChatActiveStreamId("chat-1", null, "run-1");
    expect(result).toBe(true);
    expect(updateChain).toHaveBeenCalledWith({ active_stream_id: "run-1" });
    expect(eqIdChain).toHaveBeenCalledWith("id", "chat-1");
    expect(isStreamChain).toHaveBeenCalledWith("active_stream_id", null);
  });

  it("returns true when the row update succeeds (expected=non-null)", async () => {
    selectChain.mockResolvedValue({ data: [{ id: "chat-1" }], error: null });
    const result = await compareAndSetChatActiveStreamId("chat-1", "run-old", "run-new");
    expect(result).toBe(true);
    expect(eqStreamChain).toHaveBeenCalledWith("active_stream_id", "run-old");
  });

  it("returns false when the predicate does not match (no row updated)", async () => {
    selectChain.mockResolvedValue({ data: [], error: null });
    const result = await compareAndSetChatActiveStreamId("chat-1", null, "run-1");
    expect(result).toBe(false);
  });

  it("returns false on Supabase error", async () => {
    selectChain.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await compareAndSetChatActiveStreamId("chat-1", null, "run-1");
    expect(result).toBe(false);
  });

  it("supports clearing the stream id (next=null)", async () => {
    selectChain.mockResolvedValue({ data: [{ id: "chat-1" }], error: null });
    await compareAndSetChatActiveStreamId("chat-1", "run-old", null);
    expect(updateChain).toHaveBeenCalledWith({ active_stream_id: null });
  });
});
