import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateSessionSandboxState } from "@/lib/supabase/sessions/updateSessionSandboxState";

const updateChain = vi.fn();
const eqChain = vi.fn();
const selectChain = vi.fn();
const singleChain = vi.fn();

vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    from: vi.fn(() => ({
      update: updateChain,
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  updateChain.mockReturnValue({ eq: eqChain });
  eqChain.mockReturnValue({ select: selectChain });
  selectChain.mockReturnValue({ single: singleChain });
});

describe("updateSessionSandboxState", () => {
  const baseRow = {
    id: "sess-1",
    account_id: "acc-1",
    sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
    lifecycle_state: "active",
    lifecycle_version: 2,
    sandbox_expires_at: "2030-01-01T00:00:00.000Z",
    last_activity_at: "2030-01-01T00:00:00.000Z",
  };

  it("returns the updated row on success", async () => {
    singleChain.mockResolvedValue({ data: baseRow, error: null });

    const result = await updateSessionSandboxState({
      id: "sess-1",
      sandboxState: { type: "vercel", sandboxName: "session-sess-1" },
      sandboxExpiresAt: "2030-01-01T00:00:00.000Z",
      lifecycleVersion: 2,
    });

    expect(result).toEqual(baseRow);
    expect(updateChain).toHaveBeenCalledOnce();
    expect(eqChain).toHaveBeenCalledWith("id", "sess-1");
  });

  it("returns null when supabase reports an error", async () => {
    singleChain.mockResolvedValue({ data: null, error: { message: "db down" } });

    const result = await updateSessionSandboxState({
      id: "sess-x",
      sandboxState: null,
      sandboxExpiresAt: null,
      lifecycleVersion: 1,
    });

    expect(result).toBeNull();
  });

  it("writes the supplied lifecycle fields onto the row", async () => {
    singleChain.mockResolvedValue({ data: baseRow, error: null });

    await updateSessionSandboxState({
      id: "sess-1",
      sandboxState: { type: "vercel", sandboxName: "session-sess-1" },
      sandboxExpiresAt: "2030-01-01T00:00:00.000Z",
      lifecycleVersion: 5,
    });

    const updatePayload = updateChain.mock.calls[0]?.[0];
    expect(updatePayload).toMatchObject({
      sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
      lifecycle_state: "active",
      lifecycle_version: 5,
      sandbox_expires_at: "2030-01-01T00:00:00.000Z",
    });
    expect(updatePayload.last_activity_at).toBeTypeOf("string");
  });
});
