import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateSandboxReconnectRequest } from "@/lib/sandbox/validateSandboxReconnectRequest";
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
const baseRow = { id: "sess-1", account_id: ACCOUNT_ID } as never;

function makeReq(query = "?sessionId=sess-1"): NextRequest {
  return new NextRequest(`http://localhost/api/sandbox/reconnect${query}`, { method: "GET" });
}

describe("validateSandboxReconnectRequest", () => {
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

    const result = await validateSandboxReconnectRequest(makeReq());

    expect(result).toBe(fail);
  });

  it("returns 400 when sessionId is missing from the query", async () => {
    const result = await validateSandboxReconnectRequest(makeReq(""));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 404 when no session exists with the given id", async () => {
    vi.mocked(selectSessions).mockResolvedValue([]);

    const result = await validateSandboxReconnectRequest(makeReq());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(404);
  });

  it("returns 403 when the session is not owned by the authenticated account", async () => {
    vi.mocked(selectSessions).mockResolvedValue([
      { ...baseRow, account_id: "someone-else" } as never,
    ]);

    const result = await validateSandboxReconnectRequest(makeReq());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns the validated row + auth on the happy path", async () => {
    vi.mocked(selectSessions).mockResolvedValue([baseRow]);

    const result = await validateSandboxReconnectRequest(makeReq());

    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) return;
    expect(result.row.id).toBe("sess-1");
    expect(result.auth.accountId).toBe(ACCOUNT_ID);
  });
});
