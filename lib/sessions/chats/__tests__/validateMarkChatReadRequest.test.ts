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
const { validateMarkChatReadRequest } = await import(
  "@/lib/sessions/chats/validateMarkChatReadRequest"
);

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1/read", {
    method: "POST",
  });
}

describe("validateMarkChatReadRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_1");
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
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1" })]);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_missing", "chat_1");
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
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ status: "error", error: "Forbidden" });
    }
  });

  it("returns 500 when session lookup fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue(null);
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Internal server error",
      });
    }
  });

  it("returns 500 when chat lookup fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue(null);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Internal server error",
      });
    }
  });

  it("returns 404 when the chat is missing", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([]);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_missing");
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

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Chat not found",
      });
    }
  });

  it("returns { auth, session, chat } on the happy path", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);

    const res = await validateMarkChatReadRequest(makeReq(), "sess_1", "chat_1");
    expect(res).not.toBeInstanceOf(NextResponse);
    if (!(res instanceof NextResponse)) {
      expect(res.auth.accountId).toBe(accountId);
      expect(res.session.id).toBe("sess_1");
      expect(res.chat.id).toBe("chat_1");
    }
  });
});
