import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { validateGetSessionChatsRequest } = await import(
  "@/lib/sessions/chats/validateGetSessionChatsRequest"
);

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats");
}

describe("validateGetSessionChatsRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await validateGetSessionChatsRequest(makeReq(), "sess_1");
    expect(res).toBe(failure);
    expect(selectSessions).not.toHaveBeenCalled();
  });

  it("returns 404 when the session is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await validateGetSessionChatsRequest(makeReq(), "sess_missing");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Session not found",
      });
    }
  });

  it("returns 403 when the session belongs to a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: "acc-OTHER" }),
    ]);

    const res = await validateGetSessionChatsRequest(makeReq(), "sess_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ status: "error", error: "Forbidden" });
    }
  });

  it("returns { auth, session } on the happy path", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);

    const res = await validateGetSessionChatsRequest(makeReq(), "sess_1");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.auth.accountId).toBe(accountId);
      expect(res.session.id).toBe("sess_1");
    }
    expect(selectSessions).toHaveBeenCalledWith({ id: "sess_1" });
  });
});
