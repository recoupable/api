import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSandboxReconnectHandler } from "@/lib/sandbox/getSandboxReconnectHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { connectSandbox } from "@/lib/sandbox/factory";
import { updateSession } from "@/lib/supabase/sessions/updateSession";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/sandbox/factory", () => ({
  connectSandbox: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/updateSession", () => ({
  updateSession: vi.fn(),
}));

const ACCOUNT_ID = "acc-1";
const RUNTIME_STATE = { type: "vercel", sandboxName: "session-sess-1" };

const baseRow = {
  id: "sess-1",
  account_id: ACCOUNT_ID,
  sandbox_state: null as unknown,
  lifecycle_state: null as string | null,
  lifecycle_version: 0,
  sandbox_expires_at: null as string | null,
  hibernate_after: null as string | null,
  last_activity_at: null as string | null,
  snapshot_url: null as string | null,
};

function makeReq(query = "?sessionId=sess-1"): NextRequest {
  return new NextRequest(`http://localhost/api/sandbox/reconnect${query}`, { method: "GET" });
}

function fakeAliveSandbox(expiresAt = Date.now() + 1_800_000) {
  return {
    expiresAt,
    exec: vi.fn(async () => ({
      success: true,
      exitCode: 0,
      stdout: "/workspace",
      stderr: "",
      truncated: false,
    })),
  };
}

describe("getSandboxReconnectHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
    vi.mocked(updateSession).mockResolvedValue({} as never);
  });

  it("returns the auth response unchanged when auth fails", async () => {
    const fail = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValueOnce(fail);

    const res = await getSandboxReconnectHandler(makeReq());

    expect(res).toBe(fail);
  });

  it("returns 400 when sessionId is missing", async () => {
    const res = await getSandboxReconnectHandler(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no session exists with the given id", async () => {
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await getSandboxReconnectHandler(makeReq());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the session is not owned by the authenticated account", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, account_id: "someone-else" } as never,
    ]);

    const res = await getSandboxReconnectHandler(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns status='no_sandbox' when sandbox_state has no runtime metadata", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: { type: "vercel" } } as never,
    ]);

    const res = await getSandboxReconnectHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("no_sandbox");
    expect(body.expiresAt).toBeUndefined();
    expect(connectSandbox).not.toHaveBeenCalled();
  });

  it("sets hasSnapshot=true when snapshot_url is set on a no_sandbox session", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: null, snapshot_url: "snap://x" } as never,
    ]);

    const res = await getSandboxReconnectHandler(makeReq());

    const body = await res.json();
    expect(body.status).toBe("no_sandbox");
    expect(body.hasSnapshot).toBe(true);
  });

  it("returns status='connected' with expiresAt when the runtime probe succeeds", async () => {
    const expiresAt = Date.parse("2099-01-01T00:00:00.000Z");
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE } as never,
    ]);
    vi.mocked(connectSandbox).mockResolvedValueOnce(fakeAliveSandbox(expiresAt) as never);

    const res = await getSandboxReconnectHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("connected");
    expect(body.expiresAt).toBe(expiresAt);
  });

  it("returns status='expired' and drops the resume handle on a 'sandbox not found' error", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE, lifecycle_state: "active" } as never,
    ]);
    vi.mocked(connectSandbox).mockRejectedValueOnce(new Error("sandbox not found"));

    const res = await getSandboxReconnectHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("expired");
    expect(body.expiresAt).toBeUndefined();
    // not-found means even the resume handle is stale — sandbox_state
    // collapses to just the type discriminator.
    expect(updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        sandbox_state: { type: "vercel" },
        lifecycle_state: "hibernated",
      }),
    );
  });

  // Open-agents parity: only known "permanently unavailable" errors
  // collapse the session to expired. A transient probe failure (e.g.
  // 502 / connection reset) preserves the runtime state so the next
  // reconnect attempt can succeed without forcing a full rebuild.
  it("preserves runtime state and returns 'connected' on a transient probe error", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      {
        ...baseRow,
        sandbox_state: { ...RUNTIME_STATE, expiresAt: Date.now() + 1_000_000 },
        lifecycle_state: "active",
      } as never,
    ]);
    vi.mocked(connectSandbox).mockRejectedValueOnce(new Error("Status code 502"));

    const res = await getSandboxReconnectHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("connected");
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("drops the runtime resume handle on a 'sandbox is stopped' error (preserves nothing)", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE, lifecycle_state: "active" } as never,
    ]);
    vi.mocked(connectSandbox).mockRejectedValueOnce(new Error("Sandbox is stopped"));

    const res = await getSandboxReconnectHandler(makeReq());

    const body = await res.json();
    expect(body.status).toBe("expired");
    // 'stopped' is unavailable but not not-found — keep the resume handle
    // so a future provision can pick it back up.
    expect(updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
        lifecycle_state: "hibernated",
      }),
    );
  });

  // Open-agents parity: a successful probe refreshes the row's
  // `sandbox_expires_at` from the live SDK state so the FE timer
  // matches reality.
  it("refreshes sandbox_expires_at on successful probe", async () => {
    const newExpiresAt = Date.now() + 1_800_000;
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE, lifecycle_state: "active" } as never,
    ]);
    const sb = fakeAliveSandbox(newExpiresAt);
    (sb as { getState: () => unknown }).getState = () => ({
      type: "vercel",
      sandboxName: "session-sess-1",
      expiresAt: newExpiresAt,
    });
    vi.mocked(connectSandbox).mockResolvedValueOnce(sb as never);

    await getSandboxReconnectHandler(makeReq());

    expect(updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        sandbox_expires_at: new Date(newExpiresAt).toISOString(),
      }),
    );
  });

  // Open-agents parity: when the lifecycle evaluator left the session
  // in `failed` but the runtime probe succeeds, recover it back to
  // `active` and clear the stale error.
  it("recovers lifecycle_state 'failed' to 'active' on successful probe", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE, lifecycle_state: "failed" } as never,
    ]);
    vi.mocked(connectSandbox).mockResolvedValueOnce(fakeAliveSandbox() as never);

    await getSandboxReconnectHandler(makeReq());

    expect(updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        lifecycle_state: "active",
        lifecycle_error: null,
      }),
    );
  });

  it("does NOT touch lifecycle_state on successful probe when it was already 'active'", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE, lifecycle_state: "active" } as never,
    ]);
    vi.mocked(connectSandbox).mockResolvedValueOnce(fakeAliveSandbox() as never);

    await getSandboxReconnectHandler(makeReq());

    const updateArgs = vi.mocked(updateSession).mock.calls[0]?.[1] ?? {};
    expect(updateArgs).not.toHaveProperty("lifecycle_state");
    expect(updateArgs).not.toHaveProperty("lifecycle_error");
  });

  it("includes the lifecycle envelope on every 200 response", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: { type: "vercel" } } as never,
    ]);

    const res = await getSandboxReconnectHandler(makeReq());

    const body = await res.json();
    expect(body.lifecycle).toMatchObject({
      serverTime: expect.any(Number),
      state: null,
      lastActivityAt: null,
      hibernateAfter: null,
      sandboxExpiresAt: null,
    });
  });
});
