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

  it("returns status='expired' and clears runtime state when the probe throws", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, sandbox_state: RUNTIME_STATE, lifecycle_state: "active" } as never,
    ]);
    vi.mocked(connectSandbox).mockRejectedValueOnce(new Error("sandbox not found"));

    const res = await getSandboxReconnectHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("expired");
    expect(body.expiresAt).toBeUndefined();
    expect(updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        sandbox_state: null,
        lifecycle_state: "hibernated",
      }),
    );
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
