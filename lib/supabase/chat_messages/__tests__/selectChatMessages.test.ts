import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectChatMessages } from "@/lib/supabase/chat_messages/selectChatMessages";

const selectChain = vi.fn();
const eqChain = vi.fn();
const orderChain = vi.fn();
const limitChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ select: selectChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Allow any number of chained .eq() / .order() / .limit() calls — they all
  // return the same fluent builder.
  const builder = { eq: eqChain, order: orderChain, limit: limitChain };
  selectChain.mockReturnValue(builder);
  eqChain.mockReturnValue(builder);
  orderChain.mockReturnValue(builder);
  limitChain.mockReturnValue(builder);
});

describe("selectChatMessages", () => {
  it("returns rows on success", async () => {
    limitChain.mockResolvedValue({ data: [{ id: "m-1" }], error: null });
    const result = await selectChatMessages({
      chatId: "c-1",
      orderBy: { createdAt: "asc" },
      limit: 1,
    });
    expect(result).toEqual([{ id: "m-1" }]);
    expect(eqChain).toHaveBeenCalledWith("chat_id", "c-1");
    expect(orderChain).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(limitChain).toHaveBeenCalledWith(1);
  });

  it("returns null on Supabase error (so callers can distinguish from empty)", async () => {
    // With no filters, the terminal call is on selectChain itself
    selectChain.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await selectChatMessages({});
    expect(result).toBeNull();
  });

  it("returns [] on no match", async () => {
    limitChain.mockResolvedValue({ data: [], error: null });
    const result = await selectChatMessages({ chatId: "c-1", limit: 1 });
    expect(result).toEqual([]);
  });

  it("applies desc ordering when requested", async () => {
    limitChain.mockResolvedValue({ data: [], error: null });
    await selectChatMessages({ chatId: "c-1", orderBy: { createdAt: "desc" }, limit: 1 });
    expect(orderChain).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});
