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
const { validateCreateSessionChatRequest } = await import(
  "@/lib/sessions/validateCreateSessionChatRequest"
);

const accountId = "acc-uuid-1";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function authedSession() {
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId,
    orgId: null,
    authToken: "tok",
  });
  vi.mocked(selectSessions).mockResolvedValue([
    baseSessionRow({ id: "sess_1", account_id: accountId }),
  ]);
}

describe("validateCreateSessionChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await validateCreateSessionChatRequest(makeReq({}), "sess_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(401);
    }
  });

  it("returns 404 when session does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await validateCreateSessionChatRequest(makeReq({}), "sess_missing");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
    }
  });

  it("returns 403 when session is owned by a different account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: "acc-OTHER" }),
    ]);

    const res = await validateCreateSessionChatRequest(makeReq({}), "sess_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
    }
  });

  it("returns 400 with parity error when id is an empty string", async () => {
    authedSession();

    const res = await validateCreateSessionChatRequest(makeReq({ id: "" }), "sess_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid chat id" });
    }
  });

  it("returns 400 when id is not a string", async () => {
    authedSession();

    const res = await validateCreateSessionChatRequest(makeReq({ id: 42 }), "sess_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
    }
  });

  it("returns { auth, session, body } on an empty body", async () => {
    authedSession();

    const res = await validateCreateSessionChatRequest(makeReq({}), "sess_1");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.auth.accountId).toBe(accountId);
      expect(res.session.id).toBe("sess_1");
      expect(res.body).toEqual({});
    }
  });

  it("returns { auth, session, body } with a valid id", async () => {
    authedSession();

    const res = await validateCreateSessionChatRequest(makeReq({ id: "chat_abc" }), "sess_1");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.body).toEqual({ id: "chat_abc" });
    }
  });

  it("treats malformed JSON like an empty body", async () => {
    authedSession();

    const res = await validateCreateSessionChatRequest(makeReq("{not json"), "sess_1");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.body).toEqual({});
    }
  });

  it("ignores unknown fields on the body", async () => {
    authedSession();

    const res = await validateCreateSessionChatRequest(
      makeReq({ id: "chat_abc", junk: 1 }),
      "sess_1",
    );
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.body).toEqual({ id: "chat_abc" });
    }
  });
});
