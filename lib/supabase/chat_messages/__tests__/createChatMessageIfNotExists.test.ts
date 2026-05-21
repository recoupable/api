import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChatMessageIfNotExists } from "@/lib/supabase/chat_messages/createChatMessageIfNotExists";

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

const row = {
  id: "msg-1",
  chat_id: "chat-1",
  role: "user" as const,
  parts: [{ type: "text", text: "hi" }],
};

describe("createChatMessageIfNotExists", () => {
  it("returns the inserted row when no conflict", async () => {
    maybeSingleChain.mockResolvedValue({ data: row, error: null });
    const result = await createChatMessageIfNotExists(row);
    expect(result).toEqual(row);
    expect(upsertChain).toHaveBeenCalledWith(row, { onConflict: "id", ignoreDuplicates: true });
  });

  it("returns null when the id already existed (ignored conflict)", async () => {
    maybeSingleChain.mockResolvedValue({ data: null, error: null });
    const result = await createChatMessageIfNotExists(row);
    expect(result).toBeNull();
  });

  it("returns null on Supabase error", async () => {
    maybeSingleChain.mockResolvedValue({ data: null, error: { message: "down" } });
    const result = await createChatMessageIfNotExists(row);
    expect(result).toBeNull();
  });
});
