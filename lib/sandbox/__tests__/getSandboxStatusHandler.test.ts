import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { getSandboxStatusHandler } from "@/lib/sandbox/getSandboxStatusHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

const ACCOUNT_ID = "acc-1";
const FAR_FUTURE = "2099-01-01T00:00:00.000Z";
const FAR_PAST = "2000-01-01T00:00:00.000Z";

function makeReq(query = "?sessionId=sess-1"): NextRequest {
  return new NextRequest(`http://localhost/api/sandbox/status${query}`, {
    method: "GET",
  });
}

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

describe("getSandboxStatusHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
  });

  it("returns the auth response unchanged when auth fails", async () => {
    const fail = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValueOnce(fail);

    const res = await getSandboxStatusHandler(makeReq());

    expect(res).toBe(fail);
  });

  it("returns 400 when sessionId is missing from the query string", async () => {
    const res = await getSandboxStatusHandler(makeReq(""));

    expect(res.status).toBe(400);
  });

  it("returns 404 when no session exists with the given id", async () => {
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await getSandboxStatusHandler(makeReq());

    expect(res.status).toBe(404);
  });

  it("returns 403 when the session is not owned by the authenticated account", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, account_id: "someone-else" } as any,
    ]);

    const res = await getSandboxStatusHandler(makeReq());

    expect(res.status).toBe(403);
  });

  it("returns status='active' when sandbox_state is set and not expired", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      {
        ...baseRow,
        sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
        lifecycle_state: "active",
        lifecycle_version: 3,
        sandbox_expires_at: FAR_FUTURE,
      } as any,
    ]);

    const res = await getSandboxStatusHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("active");
    expect(body.lifecycleVersion).toBe(3);
    expect(body.lifecycle.state).toBe("active");
    expect(typeof body.lifecycle.serverTime).toBe("number");
    expect(body.lifecycle.sandboxExpiresAt).toBe(Date.parse(FAR_FUTURE));
  });

  it("returns status='no_sandbox' when sandbox_state is null", async () => {
    vi.mocked(selectSessions).mockResolvedValue([{ ...baseRow } as any]);

    const res = await getSandboxStatusHandler(makeReq());

    const body = await res.json();
    expect(body.status).toBe("no_sandbox");
    expect(body.hasSnapshot).toBe(false);
  });

  it("returns status='no_sandbox' when sandbox is expired", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      {
        ...baseRow,
        sandbox_state: { type: "vercel" },
        sandbox_expires_at: FAR_PAST,
      } as any,
    ]);

    const res = await getSandboxStatusHandler(makeReq());

    const body = await res.json();
    expect(body.status).toBe("no_sandbox");
  });

  it("returns hasSnapshot=true when snapshot_url is set", async () => {
    vi.mocked(selectSessions).mockResolvedValue([{ ...baseRow, snapshot_url: "snap://x" } as any]);

    const res = await getSandboxStatusHandler(makeReq());

    const body = await res.json();
    expect(body.hasSnapshot).toBe(true);
  });

  // Regression: see PR #522 smoke-test comment. POST /api/sessions writes
  // sandbox_state: { type: "vercel" } as a type stub on insert. Before the
  // fix, isSandboxActive treated any truthy sandbox_state + null
  // sandbox_expires_at as active, so the chat loading UX would flip to
  // "ready" the moment the session was created — before any sandbox
  // existed. Status must report no_sandbox until real runtime metadata
  // (sandboxName) is written by POST /api/sandbox.
  it("returns status='no_sandbox' for the freshly-created-session type stub (no sandboxName, no expiry)", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      {
        ...baseRow,
        sandbox_state: { type: "vercel" },
        sandbox_expires_at: null,
        lifecycle_state: "provisioning",
      } as any,
    ]);

    const res = await getSandboxStatusHandler(makeReq());

    const body = await res.json();
    expect(body.status).toBe("no_sandbox");
  });

  it("returns status='active' once sandboxName is set on the state, even without explicit expiry", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      {
        ...baseRow,
        sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
        sandbox_expires_at: null,
      } as any,
    ]);

    const res = await getSandboxStatusHandler(makeReq());

    const body = await res.json();
    expect(body.status).toBe("active");
  });
});
