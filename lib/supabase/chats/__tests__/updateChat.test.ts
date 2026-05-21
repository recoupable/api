import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateChat } from "@/lib/supabase/chats/updateChat";

const updateChain = vi.fn();
const eqChain = vi.fn();
const selectChain = vi.fn();
const singleChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ update: updateChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  updateChain.mockReturnValue({ eq: eqChain });
  eqChain.mockReturnValue({ select: selectChain });
  selectChain.mockReturnValue({ single: singleChain });
});

describe("updateChat", () => {
  it("returns the updated row on success", async () => {
    const row = { id: "chat-1", title: "renamed" };
    singleChain.mockResolvedValue({ data: row, error: null });
    const result = await updateChat("chat-1", { title: "renamed" });
    expect(result).toEqual(row);
    expect(updateChain).toHaveBeenCalledWith({ title: "renamed" });
    expect(eqChain).toHaveBeenCalledWith("id", "chat-1");
  });

  it("returns null on Supabase error", async () => {
    singleChain.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await updateChat("chat-x", { title: "x" });
    expect(result).toBeNull();
  });
});
