import { describe, it, expect, vi, beforeEach } from "vitest";

import { markSessionSandboxActive } from "@/lib/sandbox/markSessionSandboxActive";
import { buildActiveLifecycleUpdate } from "@/lib/sandbox/buildActiveLifecycleUpdate";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

vi.mock("@/lib/sandbox/buildActiveLifecycleUpdate", () => ({
  buildActiveLifecycleUpdate: vi.fn(() => ({
    lifecycle_state: "active",
    sandbox_expires_at: "T+30m",
  })),
}));
vi.mock("@/lib/supabase/sessions/updateSession", () => ({ updateSession: vi.fn() }));

describe("markSessionSandboxActive", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the session with the state, bumped version, active lifecycle, and cleared snapshot", async () => {
    vi.mocked(updateSession).mockResolvedValue({ id: "sess-1" } as never);
    const sessionRow = { id: "sess-1", lifecycle_version: 4 } as never;
    const state = { type: "vercel", sandboxName: "session-sess-1" } as never;

    const out = await markSessionSandboxActive(sessionRow, state);

    expect(buildActiveLifecycleUpdate).toHaveBeenCalledWith(state);
    expect(updateSession).toHaveBeenCalledWith("sess-1", {
      sandbox_state: state,
      lifecycle_version: 5,
      lifecycle_state: "active",
      sandbox_expires_at: "T+30m",
      snapshot_url: null,
      snapshot_created_at: null,
    });
    expect(out).toEqual({ id: "sess-1" });
  });
});
