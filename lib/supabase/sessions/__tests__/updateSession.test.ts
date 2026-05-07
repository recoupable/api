import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

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

describe("updateSession", () => {
  it("returns the updated row on success", async () => {
    const row = { id: "sess-1", title: "renamed" };
    singleChain.mockResolvedValue({ data: row, error: null });

    const result = await updateSession("sess-1", { title: "renamed" });

    expect(result).toEqual(row);
    expect(updateChain).toHaveBeenCalledWith({ title: "renamed" });
    expect(eqChain).toHaveBeenCalledWith("id", "sess-1");
  });

  it("returns null when supabase reports an error", async () => {
    singleChain.mockResolvedValue({ data: null, error: { message: "down" } });

    const result = await updateSession("sess-x", { title: "x" });

    expect(result).toBeNull();
  });

  it("forwards the entire updates object to the .update() call", async () => {
    singleChain.mockResolvedValue({ data: {}, error: null });

    await updateSession("sess-1", {
      sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
      lifecycle_state: "active",
      lifecycle_version: 5,
      sandbox_expires_at: "2030-01-01T00:00:00.000Z",
      last_activity_at: "2030-01-01T00:00:00.000Z",
      snapshot_url: null,
      snapshot_created_at: null,
    });

    const payload = updateChain.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      lifecycle_state: "active",
      lifecycle_version: 5,
      snapshot_url: null,
      snapshot_created_at: null,
    });
  });
});
