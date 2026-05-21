import { describe, it, expect, vi, beforeEach } from "vitest";
import { upsertChatMessage } from "@/lib/supabase/chat_messages/upsertChatMessage";

const upsertChain = vi.fn();
const selectChain = vi.fn();
const maybeSingleChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ upsert: upsertChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  upsertChain.mockReturnValue({ select: selectChain });
  selectChain.mockReturnValue({ maybeSingle: maybeSingleChain });
});

const data = {
  id: "msg-1",
  chat_id: "chat-1",
  role: "user" as const,
  parts: [{ type: "text", text: "hi" }],
};

describe("upsertChatMessage", () => {
  it("returns ok:true with the row and isDuplicate:false on new insert", async () => {
    maybeSingleChain.mockResolvedValue({ data, error: null });
    const result = await upsertChatMessage(data);
    expect(result).toEqual({ ok: true, row: data, isDuplicate: false });
    expect(upsertChain).toHaveBeenCalledWith(data, { onConflict: "id", ignoreDuplicates: true });
  });

  it("returns ok:true with isDuplicate:true when the id already existed", async () => {
    maybeSingleChain.mockResolvedValue({ data: null, error: null });
    const result = await upsertChatMessage(data);
    expect(result).toEqual({ ok: true, row: null, isDuplicate: true });
  });

  it("returns ok:false with error on Supabase failure (distinct from duplicate)", async () => {
    maybeSingleChain.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await upsertChatMessage(data);
    expect(result).toEqual({ ok: false, error: "down" });
  });
});
