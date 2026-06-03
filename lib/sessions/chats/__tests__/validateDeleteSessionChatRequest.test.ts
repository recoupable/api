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
const { validateDeleteSessionChatRequest } = await import(
  "@/lib/sessions/chats/validateDeleteSessionChatRequest"
);

const accountId = "acc-uuid-1";

function makeReq(): NextRequest {
  return new NextRequest("https://example.com/api/sessions/sess_1/chats/chat_1", {
    method: "DELETE",
  });
}

describe("validateDeleteSessionChatRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the auth NextResponse when validateAuthContext rejects", async () => {
    const failure = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_1", "chat_1");
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

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_missing", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
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

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(403);
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

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Internal server error",
      });
    }
  });

  it("returns 404 when the chat is not in this session", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_OTHER", session_id: "sess_1" }),
      baseChatRow({ id: "chat_OTHER_2", session_id: "sess_1" }),
    ]);

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(404);
    }
  });

  it("returns 400 when the chat is the only one in the session", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([baseChatRow({ id: "chat_1", session_id: "sess_1" })]);

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeInstanceOf(NextResponse);
    if (res instanceof NextResponse) {
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        status: "error",
        error: "Cannot delete the only chat in a session",
      });
    }
  });

  it("returns null on the happy path", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "tok",
    });
    vi.mocked(selectSessions).mockResolvedValue([
      baseSessionRow({ id: "sess_1", account_id: accountId }),
    ]);
    vi.mocked(selectChats).mockResolvedValue([
      baseChatRow({ id: "chat_1", session_id: "sess_1" }),
      baseChatRow({ id: "chat_2", session_id: "sess_1" }),
    ]);

    const res = await validateDeleteSessionChatRequest(makeReq(), "sess_1", "chat_1");
    expect(res).toBeNull();
    expect(selectChats).toHaveBeenCalledWith({ sessionId: "sess_1" });
  });
});
