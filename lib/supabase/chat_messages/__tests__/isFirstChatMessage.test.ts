import { describe, it, expect, vi, beforeEach } from "vitest";
import { isFirstChatMessage } from "@/lib/supabase/chat_messages/isFirstChatMessage";

const selectChain = vi.fn();
const eqChain = vi.fn();
const orderCreatedChain = vi.fn();
const orderIdChain = vi.fn();
const limitChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ select: selectChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  selectChain.mockReturnValue({ eq: eqChain });
  eqChain.mockReturnValue({ order: orderCreatedChain });
  orderCreatedChain.mockReturnValue({ order: orderIdChain });
  orderIdChain.mockReturnValue({ limit: limitChain });
});

describe("isFirstChatMessage", () => {
  it("returns true when only one row exists and it matches the messageId", async () => {
    limitChain.mockResolvedValue({ data: [{ id: "msg-1" }], error: null });
    const result = await isFirstChatMessage("chat-1", "msg-1");
    expect(result).toBe(true);
  });

  it("returns false when the only row has a different id", async () => {
    limitChain.mockResolvedValue({ data: [{ id: "msg-other" }], error: null });
    const result = await isFirstChatMessage("chat-1", "msg-1");
    expect(result).toBe(false);
  });

  it("returns false when there are already 2+ messages in the chat", async () => {
    limitChain.mockResolvedValue({
      data: [{ id: "msg-1" }, { id: "msg-2" }],
      error: null,
    });
    const result = await isFirstChatMessage("chat-1", "msg-1");
    expect(result).toBe(false);
  });

  it("returns false when no rows are returned", async () => {
    limitChain.mockResolvedValue({ data: [], error: null });
    const result = await isFirstChatMessage("chat-1", "msg-1");
    expect(result).toBe(false);
  });

  it("returns false on Supabase error", async () => {
    limitChain.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await isFirstChatMessage("chat-1", "msg-1");
    expect(result).toBe(false);
  });
});
