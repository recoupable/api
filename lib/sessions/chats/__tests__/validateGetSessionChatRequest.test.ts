import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { baseSessionRow } from "@/lib/sessions/__tests__/baseSessionRow";
import { baseChatRow } from "@/lib/sessions/__tests__/baseChatRow";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectSessions } = await import("@/lib/supabase/sessions/selectSessions");
const { selectChats } = await import("@/lib/supabase/chats/selectChats");
const { validateGetSessionChatRequest } = await import(
  "@/lib/sessions/chats/validateGetSessionChatRequest"
);

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1");
}

describe("validateGetSessionChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await validateGetSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBe(failure);
    expect(selectSessions).not.toHaveBeenCalled();
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("returns 404 when the session is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([]);

    const res = await validateGetSessionChatRequest(makeReq(), "sess_missing", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Session not found",
      });
    }
    expect(selectChats).not.toHaveBeenCalled();
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

    const res = await validateGetSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ status: "error", error: "Forbidden" });
    }
    expect(selectChats).not.toHaveBeenCalled();
  });

  it("returns 404 when the chat does not exist", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([]);

    const res = await validateGetSessionChatRequest(makeReq(), "sess_1", "chat_missing");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Chat not found",
      });
    }
  });

  it("returns 404 when the chat belongs to a different session", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_1", session_id: "sess_OTHER" }),
    ]);

    const res = await validateGetSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Chat not found",
      });
    }
  });

  it("returns the chat row on the happy path", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);

    const res = await validateGetSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.id).toBe("chat_1");
      expect(res.session_id).toBe("sess_1");
    }
    expect(selectSessions).toHaveBeenCalledWith({ id: "sess_1" });
    expect(selectChats).toHaveBeenCalledWith({ id: "chat_1" });
  });
});
