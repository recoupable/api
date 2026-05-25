import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateChatMessageParts } from "@/lib/supabase/chat_messages/updateChatMessageParts";

const { fromMock, updateMock, eqMock } = vi.hoisted(() => {
  const updateMock = vi.fn();
  const eqMock = vi.fn();
  const fromMock = vi.fn();
  return { fromMock, updateMock, eqMock };
});

vi.mock("@/lib/supabase/serverClient", () => ({
  default: { from: fromMock },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // chained builder: from(...).update(...).eq(...) → Promise<{error}>
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ update: updateMock });
});

describe("updateChatMessageParts", () => {
  it("UPDATEs the `parts` column on chat_messages keyed by id", async () => {
    const parts = [
      { type: "text", text: "hi" },
      { type: "data-commit", id: "x", data: { status: "success" } },
    ];
    const result = await updateChatMessageParts("msg_abc", parts);

    expect(fromMock).toHaveBeenCalledWith("chat_messages");
    expect(updateMock).toHaveBeenCalledWith({ parts });
    expect(eqMock).toHaveBeenCalledWith("id", "msg_abc");
    expect(result).toEqual({ ok: true });
  });

  it("returns { ok: false, error } when supabase reports an error (does NOT throw)", async () => {
    eqMock.mockResolvedValue({ error: { message: "boom" } });
    const result = await updateChatMessageParts("msg_abc", []);
    expect(result).toEqual({ ok: false, error: "boom" });
  });

  it("returns { ok: false, error } when the supabase client itself rejects", async () => {
    eqMock.mockRejectedValue(new Error("network blip"));
    const result = await updateChatMessageParts("msg_abc", []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("network blip");
  });
});
