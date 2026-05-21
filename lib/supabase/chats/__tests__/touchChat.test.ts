import { describe, it, expect, vi, beforeEach } from "vitest";
import { touchChat } from "@/lib/supabase/chats/touchChat";

const updateChain = vi.fn();
const eqChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({ update: updateChain })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  updateChain.mockReturnValue({ eq: eqChain });
});

describe("touchChat", () => {
  it("updates the chat's updated_at to the provided timestamp", async () => {
    eqChain.mockResolvedValue({ error: null });
    const now = new Date("2026-05-21T12:00:00.000Z");
    await touchChat("chat-1", now);
    expect(updateChain).toHaveBeenCalledWith({ updated_at: now.toISOString() });
    expect(eqChain).toHaveBeenCalledWith("id", "chat-1");
  });

  it("defaults to the current time when no timestamp is provided", async () => {
    eqChain.mockResolvedValue({ error: null });
    const before = Date.now();
    await touchChat("chat-1");
    const after = Date.now();
    const payload = updateChain.mock.calls[0]?.[0] as { updated_at: string };
    const written = new Date(payload.updated_at).getTime();
    expect(written).toBeGreaterThanOrEqual(before);
    expect(written).toBeLessThanOrEqual(after);
  });

  it("does not throw on Supabase error (logs and swallows)", async () => {
    eqChain.mockResolvedValue({ error: { message: "down" } });
    await expect(touchChat("chat-1")).resolves.toBeUndefined();
  });
});
